import '@testing-library/jest-dom/vitest'

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => undefined,
    removeListener: () => undefined,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    dispatchEvent: () => false,
  }),
})

Object.defineProperty(URL, 'createObjectURL', { writable: true, value: () => 'blob:test' })
Object.defineProperty(URL, 'revokeObjectURL', { writable: true, value: () => undefined })

const values = new Map<string, string>()
const memoryStorage: Storage = {
  get length() { return values.size },
  clear: () => values.clear(),
  getItem: (key) => values.get(key) ?? null,
  key: (index) => [...values.keys()][index] ?? null,
  removeItem: (key) => { values.delete(key) },
  setItem: (key, value) => { values.set(key, String(value)) },
}
Object.defineProperty(window, 'localStorage', { configurable: true, value: memoryStorage })
Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: memoryStorage })
