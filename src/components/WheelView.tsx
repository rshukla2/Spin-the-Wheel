import type { Wheel, WheelSlice } from '../types'
import { getSlices } from '../lib/workspace'

interface WheelViewProps {
  wheel: Wheel
  rotation: number
  spinning: boolean
  reducedMotion: boolean
  winnerId: string | null
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

const LABEL_RADIUS = 184
const MAX_LABEL_WIDTH = 174

const labelFontSize = (wheel: Wheel, slice: WheelSlice) => {
  const sliceDegrees = slice.endAngle - slice.startAngle
  const preferred = wheel.settings.labelSize === 'small'
    ? 14
    : wheel.settings.labelSize === 'medium'
      ? 18
      : wheel.settings.labelSize === 'large'
        ? 24
        : 22
  const wedgeFit = sliceDegrees * 1.8
  return Math.max(9, Math.min(preferred, wedgeFit))
}

const fittedTextLength = (label: string, fontSize: number) => {
  const estimatedWidth = label.length * fontSize * 0.56
  return estimatedWidth > MAX_LABEL_WIDTH ? MAX_LABEL_WIDTH : undefined
}

export default function WheelView({ wheel, rotation, spinning, reducedMotion, winnerId, onSpin }: WheelViewProps) {
  const slices = getSlices(wheel.entries, wheel.settings.palette)
  const orderedSlices = winnerId
    ? [...slices.filter((slice) => slice.entry.id !== winnerId), ...slices.filter((slice) => slice.entry.id === winnerId)]
    : slices
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
              {orderedSlices.map((slice) => {
                const isWinner = slice.entry.id === winnerId
                const position = polar(slice.centerAngle, LABEL_RADIUS)
                const angle = normalizeAngle(slice.centerAngle)
                const flip = angle > 90 && angle < 270
                const fontSize = labelFontSize(wheel, slice)
                const textLength = fittedTextLength(slice.entry.label, fontSize)
                const lift = polar(slice.centerAngle, isWinner ? 8 : 0)
                const translateX = lift.x - 300
                const translateY = lift.y - 300
                return (
                  <g
                    key={slice.entry.id}
                    className={`wheel-slice ${winnerId && !isWinner ? 'is-muted' : ''} ${isWinner ? 'is-winner' : ''}`}
                    data-winner={isWinner ? 'true' : undefined}
                    transform={isWinner ? `translate(${translateX} ${translateY})` : undefined}
                  >
                    {slices.length === 1 ? (
                      <circle className="wheel-slice-shape" cx="300" cy="300" r="286" fill={slice.color} />
                    ) : (
                      <path className="wheel-slice-shape" d={wedgePath(slice)} fill={slice.color} />
                    )}
                    <text
                      x={position.x}
                      y={position.y}
                      className="wheel-label"
                      fontSize={fontSize}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      textLength={textLength}
                      lengthAdjust={textLength ? 'spacingAndGlyphs' : undefined}
                      transform={`rotate(${slice.centerAngle + (flip ? 180 : 0)} ${position.x} ${position.y})`}
                    >
                      {slice.entry.label}
                    </text>
                  </g>
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
          aria-label={spinning ? 'Spinning' : winnerId ? 'Spin again' : 'Spin the wheel'}
          aria-keyshortcuts="Space Enter"
        >
          <span>{spinning ? 'Spinning' : winnerId ? 'Again' : 'Spin'}</span>
          <small>{spinning ? 'good luck…' : winnerId ? 'try another' : 'tap to choose'}</small>
        </button>
      </div>
      <p className="keyboard-hint">Press <kbd>Space</kbd> to spin</p>
    </section>
  )
}
