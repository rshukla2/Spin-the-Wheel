import type { Entry, Wheel, WheelSettings, WheelSlice, WorkspaceV1 } from '../types'

export const STORAGE_KEY = 'spin-the-wheel.workspace.v1'
export const DEFAULT_PALETTE: WheelSettings['palette'] = ['#A8BFA3', '#D6BFA7', '#C8B6E2', '#F3BC8E']

export const createId = () =>
  globalThis.crypto?.randomUUID?.() ?? `id-${Date.now()}-${Math.random().toString(16).slice(2)}`

export const createEntry = (label: string, overrides: Partial<Entry> = {}): Entry => ({
  id: createId(),
  label,
  weight: 1,
  color: null,
  ...overrides,
})

export const defaultSettings = (): WheelSettings => ({
  palette: [...DEFAULT_PALETTE],
  spinDuration: 5,
  labelSize: 'auto',
  autoRemove: false,
  sound: true,
  volume: 0.45,
  confetti: true,
})

export const createWheel = (name = 'My wheel', withExamples = false): Wheel => ({
  id: createId(),
  name,
  entries: withExamples
    ? Array.from({ length: 6 }, (_, index) => createEntry(`Hook idea ${index + 1}`))
    : [],
  results: [],
  settings: defaultSettings(),
})

export const createDefaultWorkspace = (): WorkspaceV1 => {
  const wheel = createWheel('Content hooks', true)
  return { version: 1, activeWheelId: wheel.id, wheels: [wheel] }
}

export const parseLines = (value: string): string[] =>
  value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)

export const reconcileEntries = (entries: Entry[], value: string): Entry[] =>
  parseLines(value).map((label, index) => {
    const current = entries[index]
    return current ? { ...current, label } : createEntry(label)
  })

const isHex = (value: unknown): value is string =>
  typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value)

const normalizeEntry = (value: unknown): Entry | null => {
  if (!value || typeof value !== 'object') return null
  const candidate = value as Partial<Entry>
  const label = typeof candidate.label === 'string' ? candidate.label.trim() : ''
  if (!label) return null
  return {
    id: typeof candidate.id === 'string' ? candidate.id : createId(),
    label,
    weight: Number.isFinite(candidate.weight) ? Math.min(10, Math.max(1, Math.round(candidate.weight!))) : 1,
    color: isHex(candidate.color) ? candidate.color : null,
  }
}

const normalizeSettings = (value: unknown): WheelSettings => {
  const candidate = value && typeof value === 'object' ? (value as Partial<WheelSettings>) : {}
  const palette = Array.isArray(candidate.palette) && candidate.palette.length === 4 && candidate.palette.every(isHex)
    ? (candidate.palette as WheelSettings['palette'])
    : ([...DEFAULT_PALETTE] as WheelSettings['palette'])
  const spinDuration = Number.isFinite(candidate.spinDuration)
    ? Math.min(10, Math.max(2, Number(candidate.spinDuration)))
    : 5
  const labelSize = ['auto', 'small', 'medium', 'large'].includes(candidate.labelSize ?? '')
    ? candidate.labelSize!
    : 'auto'
  return {
    palette,
    spinDuration,
    labelSize,
    autoRemove: Boolean(candidate.autoRemove),
    sound: candidate.sound !== false,
    volume: Number.isFinite(candidate.volume) ? Math.min(1, Math.max(0, Number(candidate.volume))) : 0.45,
    confetti: candidate.confetti !== false,
  }
}

export const normalizeWorkspace = (value: unknown): WorkspaceV1 | null => {
  if (!value || typeof value !== 'object') return null
  const candidate = value as Partial<WorkspaceV1>
  if (!Array.isArray(candidate.wheels) || candidate.wheels.length === 0) return null
  const wheels: Wheel[] = candidate.wheels.flatMap((raw) => {
    if (!raw || typeof raw !== 'object') return []
    const wheel = raw as Partial<Wheel>
    const id = typeof wheel.id === 'string' ? wheel.id : createId()
    const results = Array.isArray(wheel.results)
      ? wheel.results.flatMap((result) => {
          if (!result || typeof result !== 'object') return []
          const record = result as Wheel['results'][number]
          if (typeof record.label !== 'string' || typeof record.selectedAt !== 'string') return []
          return [{
            id: typeof record.id === 'string' ? record.id : createId(),
            entryId: typeof record.entryId === 'string' ? record.entryId : '',
            label: record.label,
            selectedAt: record.selectedAt,
          }]
        })
      : []
    return [{
      id,
      name: typeof wheel.name === 'string' && wheel.name.trim() ? wheel.name.trim() : 'Imported wheel',
      entries: Array.isArray(wheel.entries) ? wheel.entries.flatMap((entry) => normalizeEntry(entry) ?? []) : [],
      results: results.slice(0, 100),
      settings: normalizeSettings(wheel.settings),
    }]
  })
  if (!wheels.length) return null
  const activeWheelId = wheels.some((wheel) => wheel.id === candidate.activeWheelId)
    ? candidate.activeWheelId!
    : wheels[0].id
  return { version: 1, activeWheelId, wheels }
}

export const loadWorkspace = (storage: Pick<Storage, 'getItem'> = localStorage): WorkspaceV1 => {
  try {
    const raw = storage.getItem(STORAGE_KEY)
    if (!raw) return createDefaultWorkspace()
    return normalizeWorkspace(JSON.parse(raw)) ?? createDefaultWorkspace()
  } catch {
    return createDefaultWorkspace()
  }
}

export const saveWorkspace = (
  workspace: WorkspaceV1,
  storage: Pick<Storage, 'setItem'> = localStorage,
) => storage.setItem(STORAGE_KEY, JSON.stringify(workspace))

export const getSlices = (entries: Entry[], palette: string[]): WheelSlice[] => {
  const total = entries.reduce((sum, entry) => sum + entry.weight, 0)
  if (!total) return []
  let cursor = -90
  return entries.map((entry, index) => {
    const size = (entry.weight / total) * 360
    const slice = {
      entry,
      startAngle: cursor,
      endAngle: cursor + size,
      centerAngle: cursor + size / 2,
      color: entry.color ?? palette[index % palette.length],
    }
    cursor += size
    return slice
  })
}

export const weightedPick = (entries: Entry[], random = Math.random): Entry | null => {
  const total = entries.reduce((sum, entry) => sum + entry.weight, 0)
  if (!total) return null
  let target = random() * total
  for (const entry of entries) {
    target -= entry.weight
    if (target < 0) return entry
  }
  return entries.at(-1) ?? null
}

const modulo = (value: number, divisor: number) => ((value % divisor) + divisor) % divisor

export const targetRotation = (
  currentRotation: number,
  slice: Pick<WheelSlice, 'centerAngle'>,
  turns = 6,
) => {
  const targetMod = modulo(-90 - slice.centerAngle, 360)
  const delta = modulo(targetMod - modulo(currentRotation, 360), 360)
  return currentRotation + turns * 360 + delta
}

const csvEscape = (value: string | number) => {
  const stringValue = String(value)
  return /[",\n]/.test(stringValue) ? `"${stringValue.replaceAll('"', '""')}"` : stringValue
}

export const wheelToCsv = (wheel: Wheel) => [
  'label,weight,color',
  ...wheel.entries.map((entry) => [entry.label, entry.weight, entry.color ?? ''].map(csvEscape).join(',')),
].join('\n')

const parseCsvRows = (text: string): string[][] => {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]
    if (quoted) {
      if (char === '"' && text[index + 1] === '"') {
        field += '"'
        index += 1
      } else if (char === '"') quoted = false
      else field += char
    } else if (char === '"') quoted = true
    else if (char === ',') {
      row.push(field)
      field = ''
    } else if (char === '\n') {
      row.push(field.replace(/\r$/, ''))
      rows.push(row)
      row = []
      field = ''
    } else field += char
  }
  row.push(field.replace(/\r$/, ''))
  if (row.some(Boolean)) rows.push(row)
  return rows
}

export const wheelFromCsv = (text: string, name = 'Imported CSV'): Wheel | null => {
  const rows = parseCsvRows(text)
  if (!rows.length) return null
  const header = rows[0].map((cell) => cell.trim().toLowerCase())
  const hasHeader = header.includes('label')
  const labelIndex = hasHeader ? header.indexOf('label') : 0
  const weightIndex = hasHeader ? header.indexOf('weight') : 1
  const colorIndex = hasHeader ? header.indexOf('color') : 2
  const entries = rows.slice(hasHeader ? 1 : 0).flatMap((row) => {
    const label = row[labelIndex]?.trim()
    if (!label) return []
    const rawWeight = Number(row[weightIndex])
    const color = isHex(row[colorIndex]?.trim()) ? row[colorIndex].trim() : null
    return [createEntry(label, {
      weight: Number.isFinite(rawWeight) ? Math.min(10, Math.max(1, Math.round(rawWeight))) : 1,
      color,
    })]
  })
  if (!entries.length) return null
  return { ...createWheel(name), entries }
}

export const regenerateWheelIds = (wheel: Wheel): Wheel => ({
  ...wheel,
  id: createId(),
  entries: wheel.entries.map((entry) => ({ ...entry, id: createId() })),
  results: wheel.results.map((result) => ({ ...result, id: createId(), entryId: '' })),
})
