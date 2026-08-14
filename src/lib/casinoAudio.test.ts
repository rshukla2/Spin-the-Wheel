import { casinoTickTimes } from './casinoAudio'

describe('casino wheel audio timing', () => {
  it('starts with a fast ratchet and slows toward the pointer stop', () => {
    const times = casinoTickTimes(5)
    const earlyInterval = times[2] - times[1]
    const lateInterval = times.at(-1)! - times.at(-2)!
    expect(times.length).toBeGreaterThan(40)
    expect(earlyInterval).toBeLessThan(0.05)
    expect(lateInterval).toBeGreaterThan(earlyInterval * 4)
    expect(times.at(-1)).toBeLessThan(5)
  })

  it('keeps short spins bounded', () => {
    const times = casinoTickTimes(0.1)
    expect(times.length).toBeGreaterThan(0)
    expect(times.at(-1)).toBeLessThan(0.35)
  })
})
