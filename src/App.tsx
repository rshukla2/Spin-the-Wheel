import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import WheelView from './components/WheelView'
import {
  DEFAULT_PALETTE,
  createEntry,
  createId,
  createWheel,
  ensureValidRiggedEntry,
  getSlices,
  loadWorkspace,
  normalizeWorkspace,
  reconcileEntries,
  regenerateWheelIds,
  saveWorkspace,
  targetRotation,
  weightedPick,
  wheelFromCsv,
  wheelToCsv,
} from './lib/workspace'
import type { Entry, Wheel, WorkspaceV1 } from './types'
import { playCasinoSpin, playCasinoWin } from './lib/casinoAudio'

type Panel = 'entries' | 'results' | 'settings'
type Notice = { message: string; kind?: 'error' | 'success' } | null
type WinnerState = { entry: Entry; wheelId: string; pendingRemoval: boolean }
const PALETTE_NAMES = ['Sage', 'Oat', 'Lavender', 'Peach', 'Dusty rose', 'Butter', 'Powder blue']

const downloadFile = (name: string, content: string, type: string) => {
  const url = URL.createObjectURL(new Blob([content], { type }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = name
  anchor.click()
  URL.revokeObjectURL(url)
}

const safeFileName = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'wheel'

const formatTime = (iso: string) => new Intl.DateTimeFormat(undefined, {
  month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
}).format(new Date(iso))

function App() {
  const [workspace, setWorkspace] = useState<WorkspaceV1>(() => loadWorkspace())
  const workspaceRef = useRef(workspace)
  workspaceRef.current = workspace
  const [panel, setPanel] = useState<Panel>('entries')
  const [showAdvancedEntries, setShowAdvancedEntries] = useState(false)
  const [rotation, setRotation] = useState(0)
  const [spinning, setSpinning] = useState(false)
  const [winner, setWinner] = useState<WinnerState | null>(null)
  const [notice, setNotice] = useState<Notice>(null)
  const [pendingImport, setPendingImport] = useState<WorkspaceV1 | null>(null)
  const [confettiKey, setConfettiKey] = useState(0)
  const [reducedMotion, setReducedMotion] = useState(false)
  const importRef = useRef<HTMLInputElement>(null)
  const spinTimerRef = useRef<number | null>(null)

  const wheel = useMemo(
    () => workspace.wheels.find((item) => item.id === workspace.activeWheelId) ?? workspace.wheels[0],
    [workspace],
  )
  const pendingRemovalId = winner?.wheelId === wheel.id && winner.pendingRemoval ? winner.entry.id : null
  const riggableEntries = useMemo(
    () => wheel.entries.filter((entry) => entry.id !== pendingRemovalId),
    [pendingRemovalId, wheel.entries],
  )

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => setReducedMotion(media.matches)
    update()
    media.addEventListener?.('change', update)
    return () => media.removeEventListener?.('change', update)
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try { saveWorkspace(workspace) } catch { setNotice({ message: 'Browser storage is unavailable.', kind: 'error' }) }
    }, 180)
    return () => window.clearTimeout(timer)
  }, [workspace])

  useEffect(() => {
    const flushWorkspace = () => {
      try { saveWorkspace(workspaceRef.current) } catch { /* The page is leaving, so there is nowhere to show an error. */ }
    }
    window.addEventListener('pagehide', flushWorkspace)
    return () => window.removeEventListener('pagehide', flushWorkspace)
  }, [])

  useEffect(() => () => {
    if (spinTimerRef.current) window.clearTimeout(spinTimerRef.current)
  }, [])

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      if (pendingImport) setPendingImport(null)
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [pendingImport])

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if ((event.code !== 'Space' && event.key !== ' ') || event.defaultPrevented || pendingImport) return
      const target = event.target as HTMLElement
      if (['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON'].includes(target.tagName)) return
      event.preventDefault()
      void spin()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  })

  const updateActiveWheel = useCallback((updater: (current: Wheel) => Wheel) => {
    setWorkspace((current) => ({
      ...current,
      wheels: current.wheels.map((item) => item.id === current.activeWheelId
        ? ensureValidRiggedEntry(updater(item))
        : item),
    }))
  }, [])

  const finishSpin = useCallback((selected: Entry, wheelId: string, sound: boolean, volume: number, autoRemove: boolean) => {
    setSpinning(false)
    setWinner({ entry: selected, wheelId, pendingRemoval: autoRemove })
    setConfettiKey((value) => value + 1)
    const record = {
      id: createId(),
      entryId: selected.id,
      label: selected.label,
      selectedAt: new Date().toISOString(),
    }
    setWorkspace((current) => ({
      ...current,
      wheels: current.wheels.map((item) => item.id === wheelId
        ? { ...item, results: [record, ...item.results].slice(0, 100) }
        : item),
    }))
    if (sound) playCasinoWin(volume)
  }, [])

  const spin = useCallback(() => {
    if (spinning || !wheel.entries.length) return
    const entries = winner?.wheelId === wheel.id && winner.pendingRemoval
      ? wheel.entries.filter((entry) => entry.id !== winner.entry.id)
      : wheel.entries
    const riggedWinner = entries.find((entry) => entry.id === wheel.settings.riggedEntryId)
    updateActiveWheel((current) => ({
      ...current,
      entries,
      settings: { ...current.settings, riggedEntryId: null },
    }))
    if (!entries.length) {
      setWinner(null)
      return
    }
    const selected = riggedWinner ?? weightedPick(entries)
    if (!selected) return
    const slice = getSlices(entries, wheel.settings.palette).find((item) => item.entry.id === selected.id)
    if (!slice) return
    setWinner(null)
    setSpinning(true)
    const duration = reducedMotion ? 200 : wheel.settings.spinDuration * 1000
    setRotation((current) => targetRotation(current, slice, reducedMotion ? 1 : 6 + Math.floor(Math.random() * 3)))
    if (wheel.settings.sound && !reducedMotion) {
      playCasinoSpin(wheel.settings.spinDuration, wheel.settings.volume)
    }
    spinTimerRef.current = window.setTimeout(
      () => finishSpin(selected, wheel.id, wheel.settings.sound, wheel.settings.volume, wheel.settings.autoRemove),
      duration,
    )
  }, [finishSpin, reducedMotion, spinning, updateActiveWheel, wheel, winner])

  const addWheel = () => {
    if (spinning) return
    const created = createWheel(`Wheel ${workspace.wheels.length + 1}`)
    setWorkspace((current) => ({ ...current, activeWheelId: created.id, wheels: [...current.wheels, created] }))
    setPanel('entries')
  }

  const duplicateWheel = () => {
    if (spinning) return
    const created = regenerateWheelIds({ ...wheel, name: `${wheel.name} copy`, results: [] })
    setWorkspace((current) => ({ ...current, activeWheelId: created.id, wheels: [...current.wheels, created] }))
  }

  const deleteWheel = () => {
    if (spinning || workspace.wheels.length === 1) return
    const remaining = workspace.wheels.filter((item) => item.id !== wheel.id)
    setWorkspace({ ...workspace, activeWheelId: remaining[0].id, wheels: remaining })
  }

  const setEntry = (id: string, updater: (entry: Entry) => Entry) => updateActiveWheel((current) => ({
    ...current,
    entries: current.entries.map((entry) => entry.id === id ? updater(entry) : entry),
  }))

  const moveEntry = (id: string, offset: number) => updateActiveWheel((current) => {
    const index = current.entries.findIndex((entry) => entry.id === id)
    const nextIndex = Math.max(0, Math.min(current.entries.length - 1, index + offset))
    if (index < 0 || index === nextIndex) return current
    const entries = [...current.entries]
    const [entry] = entries.splice(index, 1)
    entries.splice(nextIndex, 0, entry)
    return { ...current, entries }
  })

  const removeEntry = (id: string) => updateActiveWheel((current) => ({
    ...current,
    entries: current.entries.filter((entry) => entry.id !== id),
  }))

  const exportJson = () => downloadFile('spin-the-wheel-backup.json', JSON.stringify(workspace, null, 2), 'application/json')
  const exportCsv = () => downloadFile(`${safeFileName(wheel.name)}.csv`, wheelToCsv(wheel), 'text/csv;charset=utf-8')

  const readImport = async (file: File) => {
    try {
      const text = await file.text()
      if (file.name.toLowerCase().endsWith('.csv')) {
        const imported = wheelFromCsv(text, file.name.replace(/\.csv$/i, ''))
        if (!imported) throw new Error('No valid entries found')
        setWorkspace((current) => ({ ...current, activeWheelId: imported.id, wheels: [...current.wheels, imported] }))
        setNotice({ message: `Imported “${imported.name}”.`, kind: 'success' })
      } else {
        const imported = normalizeWorkspace(JSON.parse(text))
        if (!imported) throw new Error('Invalid backup')
        setPendingImport(imported)
      }
    } catch {
      setNotice({ message: 'That file is not a valid wheel backup or CSV.', kind: 'error' })
    } finally {
      if (importRef.current) importRef.current.value = ''
    }
  }

  const addImported = () => {
    if (!pendingImport) return
    const added = pendingImport.wheels.map(regenerateWheelIds)
    setWorkspace((current) => ({ ...current, activeWheelId: added[0].id, wheels: [...current.wheels, ...added] }))
    setPendingImport(null)
    setNotice({ message: `Added ${added.length} imported ${added.length === 1 ? 'wheel' : 'wheels'}.`, kind: 'success' })
  }

  const replaceImported = () => {
    if (!pendingImport) return
    setWorkspace(pendingImport)
    setPendingImport(null)
    setNotice({ message: 'Workspace restored from backup.', kind: 'success' })
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="./" aria-label="Spin the Wheel home">
          <span className="brand-mark" aria-hidden="true">✦</span>
          <span><strong>Spin</strong> the Wheel</span>
        </a>
        <div className="top-actions">
          <button className="quiet-button" type="button" onClick={() => importRef.current?.click()}>↥ <span>Import</span></button>
          <button className="quiet-button" type="button" onClick={exportJson}>↧ <span>Backup</span></button>
          <input ref={importRef} className="visually-hidden" type="file" accept=".json,.csv,application/json,text/csv" onChange={(event) => event.target.files?.[0] && void readImport(event.target.files[0])} />
        </div>
      </header>

      <nav className="wheel-tabs" aria-label="Saved wheels">
        <div className="wheel-tab-scroll">
          {workspace.wheels.map((item) => (
            <button
              type="button"
              key={item.id}
              className={`wheel-tab ${item.id === wheel.id ? 'active' : ''}`}
              onClick={() => !spinning && setWorkspace((current) => ({ ...current, activeWheelId: item.id }))}
              aria-current={item.id === wheel.id ? 'page' : undefined}
            >
              <span>{item.name}</span><small>{item.entries.length}</small>
            </button>
          ))}
        </div>
        <button className="add-wheel-button" type="button" onClick={addWheel} disabled={spinning}>＋ New wheel</button>
      </nav>

      <main className="workspace">
        <WheelView
          wheel={wheel}
          rotation={rotation}
          spinning={spinning}
          reducedMotion={reducedMotion}
          winnerId={winner?.wheelId === wheel.id ? winner.entry.id : null}
          onSpin={spin}
        />

        <aside className="control-panel" aria-label="Wheel controls">
          <div className="panel-tabs" role="tablist" aria-label="Wheel controls">
            {(['entries', 'results', 'settings'] as Panel[]).map((item) => (
              <button
                type="button"
                role="tab"
                aria-selected={panel === item}
                className={panel === item ? 'active' : ''}
                key={item}
                onClick={() => setPanel(item)}
              >
                {item === 'entries' ? `Entries (${wheel.entries.length})` : item === 'results' ? `Results (${wheel.results.length})` : 'Settings'}
              </button>
            ))}
          </div>

          {panel === 'entries' && (
            <div className="panel-content entries-panel" role="tabpanel">
              <div className="section-heading">
                <div><p className="eyebrow">Build your wheel</p><h2>One idea per line</h2></div>
                <button className="text-button" type="button" onClick={() => setShowAdvancedEntries((value) => !value)}>{showAdvancedEntries ? 'Simple' : 'Advanced'}</button>
              </div>
              {!showAdvancedEntries ? (
                <>
                  <textarea
                    className="entries-textarea"
                    aria-label="Wheel entries, one per line"
                    value={wheel.entries.map((entry) => entry.label).join('\n')}
                    onChange={(event) => updateActiveWheel((current) => ({ ...current, entries: reconcileEntries(current.entries, event.target.value) }))}
                    placeholder={'Start with a hook…\nAdd another idea…'}
                    spellCheck="true"
                  />
                  <p className="field-help">Blank lines are ignored. Changes save automatically in this browser.</p>
                </>
              ) : (
                <div className="entry-list">
                  {wheel.entries.map((entry, index) => (
                    <article className="entry-card" key={entry.id}>
                      <div className="entry-order">
                        <button type="button" onClick={() => moveEntry(entry.id, -1)} disabled={index === 0} aria-label={`Move ${entry.label} up`}>↑</button>
                        <button type="button" onClick={() => moveEntry(entry.id, 1)} disabled={index === wheel.entries.length - 1} aria-label={`Move ${entry.label} down`}>↓</button>
                      </div>
                      <div className="entry-fields">
                        <input aria-label={`Entry ${index + 1}`} value={entry.label} onChange={(event) => setEntry(entry.id, (current) => ({ ...current, label: event.target.value }))} />
                        <div className="entry-meta">
                          <label>Weight <input type="number" min="1" max="10" value={entry.weight} onChange={(event) => setEntry(entry.id, (current) => ({ ...current, weight: Math.min(10, Math.max(1, Number(event.target.value) || 1)) }))} /></label>
                          <label className="color-control">Color <input type="color" value={entry.color ?? wheel.settings.palette[index % wheel.settings.palette.length]} onChange={(event) => setEntry(entry.id, (current) => ({ ...current, color: event.target.value }))} /></label>
                          {entry.color && <button className="mini-button" type="button" onClick={() => setEntry(entry.id, (current) => ({ ...current, color: null }))}>Use palette</button>}
                        </div>
                      </div>
                      <div className="entry-actions">
                        <button type="button" aria-label={`Duplicate ${entry.label}`} onClick={() => updateActiveWheel((current) => { const at = current.entries.findIndex((item) => item.id === entry.id); const entries = [...current.entries]; entries.splice(at + 1, 0, { ...entry, id: createId() }); return { ...current, entries } })}>⧉</button>
                        <button type="button" className="danger-icon" aria-label={`Delete ${entry.label}`} onClick={() => removeEntry(entry.id)}>×</button>
                      </div>
                    </article>
                  ))}
                  {!wheel.entries.length && <div className="empty-state"><strong>No entries yet</strong><span>Add your first idea below.</span></div>}
                </div>
              )}

              <div className="entry-toolbar">
                <button className="primary-button" type="button" onClick={() => updateActiveWheel((current) => ({ ...current, entries: [...current.entries, createEntry(`Hook idea ${current.entries.length + 1}`)] }))}>＋ Add entry</button>
                <button className="secondary-button" type="button" onClick={() => updateActiveWheel((current) => ({ ...current, entries: [...current.entries].sort(() => Math.random() - 0.5) }))} disabled={wheel.entries.length < 2}>Shuffle</button>
                <button className="secondary-button" type="button" onClick={() => updateActiveWheel((current) => ({ ...current, entries: [...current.entries].sort((a, b) => a.label.localeCompare(b.label)) }))} disabled={wheel.entries.length < 2}>Sort</button>
              </div>
              <div className="file-toolbar">
                <button className="text-button" type="button" onClick={exportCsv}>Export current wheel as CSV</button>
              </div>
            </div>
          )}

          {panel === 'results' && (
            <div className="panel-content results-panel" role="tabpanel">
              <div className="section-heading">
                <div><p className="eyebrow">Your spin history</p><h2>Recent results</h2></div>
                {wheel.results.length > 0 && <button className="text-button danger-text" type="button" onClick={() => updateActiveWheel((current) => ({ ...current, results: [] }))}>Clear</button>}
              </div>
              <div className="result-list">
                {wheel.results.map((result, index) => (
                  <article className="result-row" key={result.id}>
                    <span className="result-number">{String(index + 1).padStart(2, '0')}</span>
                    <div><strong>{result.label}</strong><time dateTime={result.selectedAt}>{formatTime(result.selectedAt)}</time></div>
                    <div className="result-actions">
                      <button type="button" onClick={() => updateActiveWheel((current) => ({ ...current, entries: [...current.entries, createEntry(result.label)] }))}>Reuse</button>
                      <button type="button" onClick={() => updateActiveWheel((current) => ({ ...current, results: current.results.filter((item) => item.id !== result.id) }))} aria-label={`Remove ${result.label} from history`}>×</button>
                    </div>
                  </article>
                ))}
                {!wheel.results.length && <div className="empty-state large"><span className="empty-icon">◎</span><strong>Your winners will live here</strong><span>Spin the wheel to start a history.</span></div>}
              </div>
            </div>
          )}

          {panel === 'settings' && (
            <div className="panel-content settings-panel" role="tabpanel">
              <div className="section-heading"><div><p className="eyebrow">Make it yours</p><h2>Wheel settings</h2></div></div>
              <label className="setting-field"><span>Wheel name</span><input value={wheel.name} onChange={(event) => updateActiveWheel((current) => ({ ...current, name: event.target.value }))} /></label>
              <fieldset className="setting-group">
                <legend>Pastel palette</legend>
                <div className="palette-grid">
                  {wheel.settings.palette.map((color, index) => (
                    <label key={`${index}-${color}`}><input type="color" value={color} onChange={(event) => updateActiveWheel((current) => { const palette = [...current.settings.palette] as Wheel['settings']['palette']; palette[index] = event.target.value; return { ...current, settings: { ...current.settings, palette } } })} /><span>{PALETTE_NAMES[index]}</span><small>{color.toUpperCase()}</small></label>
                  ))}
                </div>
                <button className="text-button" type="button" onClick={() => updateActiveWheel((current) => ({ ...current, settings: { ...current.settings, palette: [...DEFAULT_PALETTE] } }))}>Reset pastel palette</button>
              </fieldset>
              <label className="setting-field range-field"><span>Spin duration <output>{wheel.settings.spinDuration}s</output></span><input aria-label="Spin duration" type="range" min="2" max="10" step="1" value={wheel.settings.spinDuration} onChange={(event) => updateActiveWheel((current) => ({ ...current, settings: { ...current.settings, spinDuration: Number(event.target.value) } }))} /></label>
              <label className="setting-field"><span>Label size</span><select value={wheel.settings.labelSize} onChange={(event) => updateActiveWheel((current) => ({ ...current, settings: { ...current.settings, labelSize: event.target.value as Wheel['settings']['labelSize'] } }))}><option value="auto">Automatic</option><option value="small">Small</option><option value="medium">Medium</option><option value="large">Large</option></select></label>
              <label className="setting-field">
                <span>Rigged Wheel</span>
                <select
                  aria-label="Rigged Wheel"
                  aria-describedby="rigged-wheel-help"
                  value={riggableEntries.some((entry) => entry.id === wheel.settings.riggedEntryId) ? wheel.settings.riggedEntryId ?? '' : ''}
                  disabled={spinning || riggableEntries.length === 0}
                  onChange={(event) => updateActiveWheel((current) => ({ ...current, settings: { ...current.settings, riggedEntryId: event.target.value || null } }))}
                >
                  <option value="">Random (not rigged)</option>
                  {riggableEntries.map((entry) => {
                    const matching = riggableEntries.filter((item) => item.label === entry.label)
                    const duplicateNumber = matching.findIndex((item) => item.id === entry.id) + 1
                    return <option key={entry.id} value={entry.id}>{entry.label}{matching.length > 1 ? ` (${duplicateNumber})` : ''}</option>
                  })}
                </select>
                <small className="setting-help" id="rigged-wheel-help">Choose the next winner once. This resets to random as soon as the spin begins.</small>
              </label>
              <div className="toggle-list">
                <label><span><strong>Remove winner automatically</strong><small>Removes the highlighted winner before the next spin</small></span><input type="checkbox" checked={wheel.settings.autoRemove} onChange={(event) => updateActiveWheel((current) => ({ ...current, settings: { ...current.settings, autoRemove: event.target.checked } }))} /></label>
                <label><span><strong>Casino sounds</strong><small>Vegas ratchet, wheel rush, and winner fanfare</small></span><input type="checkbox" checked={wheel.settings.sound} onChange={(event) => updateActiveWheel((current) => ({ ...current, settings: { ...current.settings, sound: event.target.checked } }))} /></label>
                {wheel.settings.sound && <label className="volume-row"><span>Volume <output>{Math.round(wheel.settings.volume * 100)}%</output></span><input type="range" min="0" max="1" step="0.05" value={wheel.settings.volume} onChange={(event) => updateActiveWheel((current) => ({ ...current, settings: { ...current.settings, volume: Number(event.target.value) } }))} /></label>}
                <label><span><strong>Winner confetti</strong><small>Disabled when reduced motion is on</small></span><input type="checkbox" checked={wheel.settings.confetti} onChange={(event) => updateActiveWheel((current) => ({ ...current, settings: { ...current.settings, confetti: event.target.checked } }))} /></label>
              </div>
              <div className="wheel-management">
                <button className="secondary-button" type="button" onClick={duplicateWheel} disabled={spinning}>Duplicate wheel</button>
                <button className="secondary-button danger-text" type="button" onClick={deleteWheel} disabled={spinning || workspace.wheels.length === 1}>Delete wheel</button>
              </div>
            </div>
          )}
        </aside>
      </main>

      <div className="aria-live visually-hidden" aria-live="polite">{winner ? `Winner: ${winner.entry.label}` : ''}</div>

      {winner?.wheelId === wheel.id && wheel.settings.confetti && !reducedMotion && (
        <div className="confetti" key={confettiKey} aria-hidden="true">
          {Array.from({ length: 28 }, (_, index) => <i key={index} style={{ '--i': index } as React.CSSProperties} />)}
        </div>
      )}

      {pendingImport && (
        <div className="modal-backdrop">
          <section className="import-card" role="dialog" aria-modal="true" aria-labelledby="import-title">
            <span className="winner-kicker">Valid backup found</span>
            <h2 id="import-title">Import {pendingImport.wheels.length} {pendingImport.wheels.length === 1 ? 'wheel' : 'wheels'}</h2>
            <p>Add them beside your current wheels, or replace everything with this backup.</p>
            <div className="winner-actions stack-mobile">
              <button className="primary-button" type="button" onClick={addImported}>Add to workspace</button>
              <button className="secondary-button" type="button" onClick={replaceImported}>Replace workspace</button>
              <button className="text-button" type="button" onClick={() => setPendingImport(null)}>Cancel</button>
            </div>
          </section>
        </div>
      )}

      {notice && <div className={`notice ${notice.kind ?? ''}`} role="status"><span>{notice.message}</span><button type="button" onClick={() => setNotice(null)} aria-label="Dismiss notification">×</button></div>}
    </div>
  )
}

export default App
