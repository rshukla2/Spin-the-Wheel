import {
  STORAGE_KEY,
  createEntry,
  createWheel,
  getSlices,
  loadWorkspace,
  normalizeWorkspace,
  parseLines,
  reconcileEntries,
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
