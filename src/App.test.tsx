import { act, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from './App'
import { STORAGE_KEY } from './lib/workspace'

describe('App', () => {
  beforeEach(() => localStorage.clear())

  it('starts with editable examples and updates the wheel from lines', () => {
    render(<App />)
    const editor = screen.getByRole('textbox', { name: /wheel entries/i })
    expect(editor).toHaveValue('Hook idea 1\nHook idea 2\nHook idea 3\nHook idea 4\nHook idea 5\nHook idea 6')
    fireEvent.change(editor, { target: { value: 'Story hook\nContrarian hook' } })
    expect(screen.getByRole('tab', { name: 'Entries (2)' })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: /wheel with 2 entries/i })).toHaveTextContent('Story hook, Contrarian hook')
  })

  it('creates, renames, and duplicates named wheels', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByRole('button', { name: /new wheel/i }))
    expect(screen.getByRole('heading', { level: 1, name: 'Wheel 2' })).toBeInTheDocument()
    await user.click(screen.getByRole('tab', { name: 'Settings' }))
    const name = screen.getByLabelText('Wheel name')
    await user.clear(name)
    await user.type(name, 'Reel formats')
    expect(screen.getByRole('heading', { level: 1, name: 'Reel formats' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Duplicate wheel' }))
    expect(screen.getByRole('button', { name: /Reel formats copy/ })).toBeInTheDocument()
  })

  it('spins, records a result, and lets the user remove the winner', async () => {
    vi.useFakeTimers()
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: 'Spin the wheel' }))
    await act(() => vi.advanceTimersByTimeAsync(5_100))
    const dialog = screen.getByRole('dialog', { name: /Hook idea/i })
    expect(within(dialog).getByText('The wheel chose')).toBeInTheDocument()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Remove entry' }))
    expect(screen.getByRole('tab', { name: 'Entries (5)' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('tab', { name: /Results \(1\)/ }))
    expect(within(screen.getByRole('tabpanel')).getByText(/Hook idea/)).toBeInTheDocument()
    vi.useRealTimers()
  })

  it('autosaves the workspace in versioned browser storage', async () => {
    vi.useFakeTimers()
    render(<App />)
    fireEvent.change(screen.getByRole('textbox', { name: /wheel entries/i }), { target: { value: 'Saved idea' } })
    await vi.advanceTimersByTimeAsync(250)
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')
    expect(stored.version).toBe(1)
    expect(stored.wheels[0].entries[0].label).toBe('Saved idea')
    vi.useRealTimers()
  })
})
