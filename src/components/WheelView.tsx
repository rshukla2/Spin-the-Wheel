import type { Wheel, WheelSlice } from '../types'
import { getSlices } from '../lib/workspace'

interface WheelViewProps {
  wheel: Wheel
  rotation: number
  spinning: boolean
  reducedMotion: boolean
  onSpin: () => void
}

const polar = (angle: number, radius: number) => {
  const radians = (angle * Math.PI) / 180
  return { x: 300 + radius * Math.cos(radians), y: 300 + radius * Math.sin(radians) }
}

const wedgePath = (slice: WheelSlice) => {
  if (slice.endAngle - slice.startAngle >= 359.999) return ''
  const start = polar(slice.startAngle, 286)
  const end = polar(slice.endAngle, 286)
  const largeArc = slice.endAngle - slice.startAngle > 180 ? 1 : 0
  return `M 300 300 L ${start.x} ${start.y} A 286 286 0 ${largeArc} 1 ${end.x} ${end.y} Z`
}

const normalizeAngle = (angle: number) => ((angle % 360) + 360) % 360

const labelFontSize = (wheel: Wheel, slice: WheelSlice) => {
  if (wheel.settings.labelSize === 'small') return 13
  if (wheel.settings.labelSize === 'medium') return 17
  if (wheel.settings.labelSize === 'large') return 21
  const sliceDegrees = slice.endAngle - slice.startAngle
  return Math.max(10, Math.min(20, sliceDegrees * 0.36, 250 / Math.max(8, slice.entry.label.length)))
}

const visibleLabel = (label: string, count: number) => {
  const max = count > 24 ? 12 : count > 12 ? 18 : 28
  return label.length > max ? `${label.slice(0, max - 1)}…` : label
}

export default function WheelView({ wheel, rotation, spinning, reducedMotion, onSpin }: WheelViewProps) {
  const slices = getSlices(wheel.entries, wheel.settings.palette)
  const transitionSeconds = reducedMotion ? 0.2 : wheel.settings.spinDuration

  return (
    <section className="wheel-stage" aria-labelledby="wheel-title">
      <div className="wheel-heading">
        <div>
          <p className="eyebrow">Your creative compass</p>
          <h1 id="wheel-title">{wheel.name}</h1>
        </div>
        <span className="entry-count">{wheel.entries.length} {wheel.entries.length === 1 ? 'idea' : 'ideas'}</span>
      </div>

      <div className={`wheel-wrap ${spinning ? 'is-spinning' : ''}`}>
        <div className="wheel-pointer" aria-hidden="true"><span /></div>
        {slices.length ? (
          <svg
            className="wheel-svg"
            viewBox="0 0 600 600"
            role="img"
            aria-label={`${wheel.name} wheel with ${slices.length} entries`}
          >
            <desc>{wheel.entries.map((entry) => entry.label).join(', ')}</desc>
            <g
              style={{
                transform: `rotate(${rotation}deg)`,
                transformOrigin: '300px 300px',
                transition: `transform ${transitionSeconds}s cubic-bezier(.12,.62,.08,1)`,
              }}
            >
              {slices.length === 1 ? (
                <circle cx="300" cy="300" r="286" fill={slices[0].color} />
              ) : slices.map((slice) => (
                <path key={slice.entry.id} d={wedgePath(slice)} fill={slice.color} />
              ))}
              {slices.map((slice) => {
                const position = polar(slice.centerAngle, 188)
                const angle = normalizeAngle(slice.centerAngle)
                const flip = angle > 90 && angle < 270
                return (
                  <text
                    key={`label-${slice.entry.id}`}
                    x={position.x}
                    y={position.y}
                    className="wheel-label"
                    fontSize={labelFontSize(wheel, slice)}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    transform={`rotate(${slice.centerAngle + (flip ? 180 : 0)} ${position.x} ${position.y})`}
                  >
                    {visibleLabel(slice.entry.label, slices.length)}
                  </text>
                )
              })}
              <circle cx="300" cy="300" r="286" className="wheel-outline" />
            </g>
          </svg>
        ) : (
          <div className="empty-wheel" aria-label="Empty wheel">
            <span>One line.<br />One possibility.</span>
          </div>
        )}

        <button
          className="spin-button"
          type="button"
          onClick={onSpin}
          disabled={spinning || wheel.entries.length === 0}
          aria-label={spinning ? 'Spinning' : 'Spin the wheel'}
          aria-keyshortcuts="Space Enter"
        >
          <span>{spinning ? 'Spinning' : 'Spin'}</span>
          <small>{spinning ? 'good luck…' : 'tap to choose'}</small>
        </button>
      </div>
      <p className="keyboard-hint">Press <kbd>Space</kbd> to spin</p>
    </section>
  )
}
