import {
  STORAGE_KEY,
  createEntry,
  createWheel,
  getSlices,
  loadWorkspace,
  normalizeWorkspace,
  parseLines,
  reconcileEntries,
  regenerateWheelIds,
  targetRotation,
  weightedPick,
  wheelFromCsv,
  wheelToCsv,
} from './workspace'

describe('workspace utilities', () => {
  it('turns non-empty trimmed lines into entries', () => {
    expect(parseLines(' First hook \n\n Second hook\r\n ')).toEqual(['First hook', 'Second hook'])
  })

  it('preserves advanced attributes while editing by line position', () => {
    const original = createEntry('Old', { weight: 4, color: '#A8BFA3' })
    const [updated, added] = reconcileEntries([original], 'New label\nAnother')
    expect(updated).toMatchObject({ id: original.id, label: 'New label', weight: 4, color: '#A8BFA3' })
    expect(added.label).toBe('Another')
  })

  it('preserves entry identity across deletion, reordering, and renaming', () => {
    const first = createEntry('First')
    const selected = createEntry('Selected')
    const third = createEntry('Third')

    const reordered = reconcileEntries([first, selected, third], 'Third\nFirst')
    expect(reordered.map((entry) => entry.id)).toEqual([third.id, first.id])
    expect(reordered.some((entry) => entry.id === selected.id)).toBe(false)

    const renamed = reconcileEntries([first, selected, third], 'First\nRenamed\nThird')
    expect(renamed[1]).toMatchObject({ id: selected.id, label: 'Renamed' })
  })

  it('uses weights when selecting and sizing slices', () => {
    const entries = [createEntry('Small'), createEntry('Large', { weight: 3 })]
    expect(weightedPick(entries, () => 0.1)?.label).toBe('Small')
    expect(weightedPick(entries, () => 0.9)?.label).toBe('Large')
    const slices = getSlices(entries, ['#A8BFA3', '#D6BFA7'])
    expect(slices[0].endAngle - slices[0].startAngle).toBe(90)
    expect(slices[1].endAngle - slices[1].startAngle).toBe(270)
  })

  it('calculates a rotation that lands the slice center at the pointer', () => {
    const next = targetRotation(137, { centerAngle: 35 }, 6)
    expect(((35 + next + 90) % 360 + 360) % 360).toBeCloseTo(0)
    expect(next).toBeGreaterThan(137 + 5 * 360)
  })

  it('recovers from malformed browser storage', () => {
    const storage = { getItem: (key: string) => key === STORAGE_KEY ? '{nope' : null }
    const workspace = loadWorkspace(storage)
    expect(workspace.version).toBe(1)
    expect(workspace.wheels[0].entries).toHaveLength(6)
  })

  it('rejects invalid backups', () => {
    expect(normalizeWorkspace({ version: 1, wheels: [] })).toBeNull()
    expect(normalizeWorkspace({ hello: 'world' })).toBeNull()
  })

  it('extends legacy four-color palettes to the seven-color template', () => {
    const wheel = createWheel('Legacy')
    const legacyPalette = ['#111111', '#222222', '#333333', '#444444']
    const normalized = normalizeWorkspace({
      version: 1,
      activeWheelId: wheel.id,
      wheels: [{ ...wheel, settings: { ...wheel.settings, palette: legacyPalette } }],
    })
    expect(normalized?.wheels[0].settings.palette).toHaveLength(7)
    expect(normalized?.wheels[0].settings.palette.slice(0, 4)).toEqual(legacyPalette)
    expect(normalized?.wheels[0].settings.palette.slice(4)).toEqual(['#E4AEB4', '#E8D58A', '#AFC9D6'])
    expect(normalized?.wheels[0].settings.riggedEntryId).toBeNull()
  })

  it('keeps valid rigged targets and clears missing targets during normalization', () => {
    const wheel = createWheel('Rigged')
    const target = createEntry('Target')
    wheel.entries = [target]
    wheel.settings.riggedEntryId = target.id
    expect(normalizeWorkspace({ version: 1, activeWheelId: wheel.id, wheels: [wheel] })?.wheels[0].settings.riggedEntryId).toBe(target.id)

    wheel.settings.riggedEntryId = 'missing-entry'
    expect(normalizeWorkspace({ version: 1, activeWheelId: wheel.id, wheels: [wheel] })?.wheels[0].settings.riggedEntryId).toBeNull()
  })

  it('remaps a queued rigged target when regenerating wheel IDs', () => {
    const wheel = createWheel('Copy me')
    wheel.entries = [createEntry('First'), createEntry('Target')]
    wheel.settings.riggedEntryId = wheel.entries[1].id

    const regenerated = regenerateWheelIds(wheel)
    expect(regenerated.entries[1].id).not.toBe(wheel.entries[1].id)
    expect(regenerated.settings.riggedEntryId).toBe(regenerated.entries[1].id)
  })

  it('round-trips labels, weights, and colors through CSV', () => {
    const wheel = createWheel('Hooks')
    wheel.entries = [
      createEntry('A hook, with a comma', { weight: 3, color: '#C8B6E2' }),
      createEntry('A "quoted" hook'),
    ]
    const imported = wheelFromCsv(wheelToCsv(wheel), 'Imported')
    expect(imported?.entries).toMatchObject([
      { label: 'A hook, with a comma', weight: 3, color: '#C8B6E2' },
      { label: 'A "quoted" hook', weight: 1, color: null },
    ])
  })
})
