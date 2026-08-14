type SafariWindow = Window & typeof globalThis & {
  webkitAudioContext?: typeof AudioContext
}

let sharedContext: AudioContext | null = null

const getContext = () => {
  const AudioContextClass = window.AudioContext ?? (window as SafariWindow).webkitAudioContext
  if (!AudioContextClass) return null
  sharedContext ??= new AudioContextClass()
  if (sharedContext.state === 'suspended') void sharedContext.resume()
  return sharedContext
}

const clampVolume = (volume: number) => Math.min(1, Math.max(0, volume))

const createOutput = (context: AudioContext, volume: number) => {
  const master = context.createGain()
  const compressor = context.createDynamicsCompressor()
  master.gain.value = clampVolume(volume) * 0.9
  compressor.threshold.value = -18
  compressor.knee.value = 14
  compressor.ratio.value = 8
  compressor.attack.value = 0.003
  compressor.release.value = 0.18
  master.connect(compressor).connect(context.destination)
  return master
}

const noiseBuffer = (context: AudioContext, seconds: number) => {
  const buffer = context.createBuffer(1, Math.ceil(context.sampleRate * seconds), context.sampleRate)
  const channel = buffer.getChannelData(0)
  for (let index = 0; index < channel.length; index += 1) {
    channel[index] = Math.random() * 2 - 1
  }
  return buffer
}

export const casinoTickTimes = (durationSeconds: number) => {
  const duration = Math.max(0.35, durationSeconds)
  const times: number[] = []
  let elapsed = 0.045
  while (elapsed < duration - 0.06 && times.length < 150) {
    times.push(elapsed)
    const progress = elapsed / duration
    elapsed += 0.034 + 0.31 * progress ** 3.2
  }
  return times
}

const scheduleRatchetClick = (
  context: AudioContext,
  output: AudioNode,
  startsAt: number,
  accent: boolean,
) => {
  const oscillator = context.createOscillator()
  const filter = context.createBiquadFilter()
  const gain = context.createGain()
  oscillator.type = accent ? 'square' : 'triangle'
  oscillator.frequency.setValueAtTime(accent ? 2_400 : 1_850, startsAt)
  oscillator.frequency.exponentialRampToValueAtTime(accent ? 190 : 135, startsAt + 0.036)
  filter.type = 'bandpass'
  filter.frequency.value = accent ? 1_800 : 1_300
  filter.Q.value = 0.85
  gain.gain.setValueAtTime(0.0001, startsAt)
  gain.gain.exponentialRampToValueAtTime(accent ? 0.82 : 0.58, startsAt + 0.002)
  gain.gain.exponentialRampToValueAtTime(0.0001, startsAt + 0.04)
  oscillator.connect(filter).connect(gain).connect(output)
  oscillator.start(startsAt)
  oscillator.stop(startsAt + 0.045)
}

const scheduleSpinWhoosh = (context: AudioContext, output: AudioNode, startsAt: number) => {
  const source = context.createBufferSource()
  const filter = context.createBiquadFilter()
  const gain = context.createGain()
  source.buffer = noiseBuffer(context, 0.72)
  filter.type = 'bandpass'
  filter.Q.value = 0.7
  filter.frequency.setValueAtTime(240, startsAt)
  filter.frequency.exponentialRampToValueAtTime(3_200, startsAt + 0.22)
  filter.frequency.exponentialRampToValueAtTime(620, startsAt + 0.7)
  gain.gain.setValueAtTime(0.0001, startsAt)
  gain.gain.exponentialRampToValueAtTime(0.38, startsAt + 0.07)
  gain.gain.exponentialRampToValueAtTime(0.0001, startsAt + 0.7)
  source.connect(filter).connect(gain).connect(output)
  source.start(startsAt)

  const motor = context.createOscillator()
  const motorGain = context.createGain()
  motor.type = 'sawtooth'
  motor.frequency.setValueAtTime(58, startsAt)
  motor.frequency.exponentialRampToValueAtTime(150, startsAt + 0.16)
  motor.frequency.exponentialRampToValueAtTime(72, startsAt + 0.64)
  motorGain.gain.setValueAtTime(0.0001, startsAt)
  motorGain.gain.exponentialRampToValueAtTime(0.18, startsAt + 0.035)
  motorGain.gain.exponentialRampToValueAtTime(0.0001, startsAt + 0.68)
  motor.connect(motorGain).connect(output)
  motor.start(startsAt)
  motor.stop(startsAt + 0.7)
}

export const playCasinoSpin = (durationSeconds: number, volume: number) => {
  try {
    const context = getContext()
    if (!context || volume <= 0) return
    const output = createOutput(context, volume)
    const startsAt = context.currentTime + 0.015
    scheduleSpinWhoosh(context, output, startsAt)
    casinoTickTimes(durationSeconds).forEach((time, index) => {
      scheduleRatchetClick(context, output, startsAt + time, index % 7 === 0)
    })
  } catch {
    // Sound is enhancement-only; blocked audio must never stop a spin.
  }
}

const scheduleFanfareNote = (
  context: AudioContext,
  output: AudioNode,
  frequency: number,
  startsAt: number,
  length: number,
  strength: number,
) => {
  const oscillator = context.createOscillator()
  const overtone = context.createOscillator()
  const filter = context.createBiquadFilter()
  const gain = context.createGain()
  oscillator.type = 'sawtooth'
  overtone.type = 'square'
  oscillator.frequency.value = frequency
  overtone.frequency.value = frequency * 2
  filter.type = 'lowpass'
  filter.frequency.setValueAtTime(4_800, startsAt)
  filter.frequency.exponentialRampToValueAtTime(1_250, startsAt + length)
  gain.gain.setValueAtTime(0.0001, startsAt)
  gain.gain.exponentialRampToValueAtTime(strength, startsAt + 0.018)
  gain.gain.setValueAtTime(strength * 0.72, startsAt + Math.min(0.12, length / 2))
  gain.gain.exponentialRampToValueAtTime(0.0001, startsAt + length)
  oscillator.connect(filter)
  overtone.connect(filter)
  filter.connect(gain).connect(output)
  oscillator.start(startsAt)
  overtone.start(startsAt)
  oscillator.stop(startsAt + length)
  overtone.stop(startsAt + length)
}

export const playCasinoWin = (volume: number) => {
  try {
    const context = getContext()
    if (!context || volume <= 0) return
    const output = createOutput(context, volume)
    const startsAt = context.currentTime + 0.02

    const impact = context.createBufferSource()
    const impactFilter = context.createBiquadFilter()
    const impactGain = context.createGain()
    impact.buffer = noiseBuffer(context, 0.32)
    impactFilter.type = 'highpass'
    impactFilter.frequency.value = 1_500
    impactGain.gain.setValueAtTime(0.75, startsAt)
    impactGain.gain.exponentialRampToValueAtTime(0.0001, startsAt + 0.3)
    impact.connect(impactFilter).connect(impactGain).connect(output)
    impact.start(startsAt)

    const bass = context.createOscillator()
    const bassGain = context.createGain()
    bass.type = 'square'
    bass.frequency.setValueAtTime(105, startsAt)
    bass.frequency.exponentialRampToValueAtTime(52, startsAt + 0.28)
    bassGain.gain.setValueAtTime(0.5, startsAt)
    bassGain.gain.exponentialRampToValueAtTime(0.0001, startsAt + 0.3)
    bass.connect(bassGain).connect(output)
    bass.start(startsAt)
    bass.stop(startsAt + 0.31)

    const melody = [
      { frequency: 523.25, offset: 0, length: 0.34 },
      { frequency: 659.25, offset: 0.09, length: 0.34 },
      { frequency: 783.99, offset: 0.18, length: 0.38 },
      { frequency: 1_046.5, offset: 0.3, length: 0.72 },
    ]
    melody.forEach((note, index) => {
      scheduleFanfareNote(context, output, note.frequency, startsAt + note.offset, note.length, index === 3 ? 0.28 : 0.2)
    })
    ;[261.63, 329.63, 392].forEach((frequency) => {
      scheduleFanfareNote(context, output, frequency, startsAt + 0.29, 0.68, 0.095)
    })
  } catch {
    // Sound is enhancement-only; blocked audio must never hide the result.
  }
}
