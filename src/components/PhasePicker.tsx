import {
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import { CaretLeftIcon } from '@phosphor-icons/react/dist/csr/CaretLeft'
import { CaretRightIcon } from '@phosphor-icons/react/dist/csr/CaretRight'
import { UNCERTAINTY_LEVELS, UNCERTAINTY_GUIDANCE } from '../calc'

interface PhasePickerProps {
  index: number
  onChange: (index: number) => void
  className?: string
}

/** The cone-of-uncertainty curve visualization + drag/snap math below is ported
 *  from design_handoffs/design_handoff_uncertainty_range/Cone Slider - Interactive
 *  Prototype.dc.html — port changes there, don't re-derive the geometry by eye. */

const VIEW_WIDTH = 560
const CURVE_HEIGHT = 1.5
const BASE_H = 90 * CURVE_HEIGHT
const SVG_TOP_LARGE = 110
const V_POS = -36
const PATH_SHIFT = (V_POS - 50) * 0.6
const CONNECTOR_TOP = 35
const CONNECTOR_HEIGHT_LARGE = 165
const DIAMOND_TOP_LARGE = 200
const GAP = 54
const LABEL_V_POS = 52
const UPPER_CURVE_TOP = SVG_TOP_LARGE - GAP / 2
const MIRROR_TOP = SVG_TOP_LARGE + 90 + GAP / 2
const AXIS_LABEL_TOP = SVG_TOP_LARGE + 90 + LABEL_V_POS
const CONTAINER_HEIGHT = Math.max(320, MIRROR_TOP + 90 + 40, AXIS_LABEL_TOP + 40)
const FILL_SVG_TOP = UPPER_CURVE_TOP
const FILL_SVG_HEIGHT = MIRROR_TOP + 90 - UPPER_CURVE_TOP

const SNAP_TRANSITION_MS = 220

const fmt = (n: number) => (Math.round(n * 100) / 100).toString()

interface Point {
  x: number
  y: number
}

function scaleX(oldX: number, base: number): number {
  const ex = 0.41 * VIEW_WIDTH
  return oldX <= base
    ? oldX * (ex / base)
    : ex + ((oldX - base) * (VIEW_WIDTH - ex)) / (VIEW_WIDTH - base)
}

function sx(x: number): number {
  return Math.round(scaleX(x, 180) * 100) / 100
}

function cubicPt(p0: Point, p1: Point, p2: Point, p3: Point, t: number): Point {
  const mt = 1 - t
  return {
    x: mt ** 3 * p0.x + 3 * mt ** 2 * t * p1.x + 3 * mt * t ** 2 * p2.x + t ** 3 * p3.x,
    y: mt ** 3 * p0.y + 3 * mt ** 2 * t * p1.y + 3 * mt * t ** 2 * p2.y + t ** 3 * p3.y,
  }
}

function anchors(baseH: number) {
  return [
    {
      p0: { x: 0, y: 2 },
      p1: { x: 0, y: 2 },
      p2: { x: sx(180), y: 2 + (baseH - 2) * 0.756 },
      p3: { x: sx(180), y: 2 + (baseH - 2) * 0.756 },
    },
    {
      p0: { x: sx(180), y: 2 + (baseH - 2) * 0.756 },
      p1: { x: sx(220), y: 2 + (baseH - 2) * 0.889 },
      p2: { x: sx(260), y: 2 + (baseH - 2) * 0.933 },
      p3: { x: 560, y: baseH },
    },
  ]
}

function samplePoints(baseH: number, steps = 24): Point[] {
  const pts: Point[] = []
  anchors(baseH).forEach((seg) => {
    for (let i = 0; i <= steps; i++) {
      const pt = cubicPt(seg.p0, seg.p1, seg.p2, seg.p3, i / steps)
      pts.push({ x: pt.x, y: pt.y + PATH_SHIFT })
    }
  })
  return pts
}

function pathString(baseH: number): string {
  return `M0,2 L${sx(180)},${2 + (baseH - 2) * 0.756} C${sx(220)},${2 + (baseH - 2) * 0.889} ${sx(260)},${2 + (baseH - 2) * 0.933} 560,${baseH}`
}

function buildFillPath(baseH: number): string {
  const pts = samplePoints(baseH)
  const topY = (y: number) => y
  const botY = (y: number) => MIRROR_TOP - UPPER_CURVE_TOP + (90 - y)
  let d = `M0,${fmt(topY(pts[0]!.y))}`
  pts.forEach((pt) => {
    d += ` L${fmt(pt.x)},${fmt(topY(pt.y))}`
  })
  d += ` L560,${fmt(botY(pts[pts.length - 1]!.y))}`
  for (let i = pts.length - 1; i >= 0; i--) {
    d += ` L${fmt(pts[i]!.x)},${fmt(botY(pts[i]!.y))}`
  }
  d += ' Z'
  return d
}

const CONE_PATH_LARGE = pathString(BASE_H)
const FILL_PATH = buildFillPath(BASE_H)

const PHASES = UNCERTAINTY_LEVELS.map((level) => UNCERTAINTY_GUIDANCE[level])

const LOG_MIN = Math.log(0.2)
const LOG_MAX = Math.log(5)
const logPct = (mult: number) => ((Math.log(mult) - LOG_MIN) / (LOG_MAX - LOG_MIN)) * 100

export function PhasePicker({ index, onChange, className }: PhasePickerProps) {
  const [dragPct, setDragPct] = useState<number | null>(null)
  const [snapping, setSnapping] = useState(false)
  const trackRef = useRef<HTMLDivElement>(null)
  const snapTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const activeDragRef = useRef<{
    move: (ev: PointerEvent) => void
    up: () => void
  } | null>(null)

  useEffect(() => {
    return () => {
      if (snapTimeoutRef.current) {
        clearTimeout(snapTimeoutRef.current)
      }
      // A drag can outlive this component (e.g. the panel remounts mid-drag via
      // Workspace's key={activeItem.id}) — drop the stale listeners so a later
      // pointerup elsewhere on the page can't call back into an unmounted instance.
      if (activeDragRef.current) {
        window.removeEventListener('pointermove', activeDragRef.current.move)
        window.removeEventListener('pointerup', activeDragRef.current.up)
        activeDragRef.current = null
      }
    }
  }, [])

  function snapTo(nextIndex: number) {
    onChange(Math.max(0, Math.min(4, nextIndex)))
    setSnapping(true)
    if (snapTimeoutRef.current) {
      clearTimeout(snapTimeoutRef.current)
    }
    snapTimeoutRef.current = setTimeout(() => setSnapping(false), 260)
  }

  function handlePointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    e.preventDefault()
    const track = trackRef.current
    if (!track) {
      return
    }
    const rect = track.getBoundingClientRect()

    const move = (ev: PointerEvent) => {
      const pct = Math.max(
        0,
        Math.min(100, ((ev.clientX - rect.left) / rect.width) * 100),
      )
      setDragPct(pct)
    }
    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      activeDragRef.current = null
      setDragPct((currentDragPct) => {
        if (currentDragPct != null) {
          snapTo(Math.round(currentDragPct / 25))
        }
        return null
      })
    }
    activeDragRef.current = { move, up }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    move(e.nativeEvent)
  }

  const phase = PHASES[index]!
  const ratio = phase.highMult / phase.lowMult
  const tickPercent = dragPct ?? index * 25
  const transitionMs = dragPct != null ? 0 : snapping ? SNAP_TRANSITION_MS : 0
  const barLeft = Math.max(0, logPct(phase.lowMult))
  const barRight = Math.max(0, 100 - logPct(phase.highMult))

  return (
    <div className={['phase-picker', className].filter(Boolean).join(' ')}>
      <div
        ref={trackRef}
        className="phase-picker-track"
        style={{ height: CONTAINER_HEIGHT }}
        onPointerDown={handlePointerDown}
      >
        <svg
          viewBox={`0 0 560 ${FILL_SVG_HEIGHT}`}
          preserveAspectRatio="none"
          className="phase-picker-fill"
          style={{ top: FILL_SVG_TOP, height: FILL_SVG_HEIGHT }}
        >
          <defs>
            <linearGradient
              id="phase-picker-fill-gradient"
              x1="0%"
              y1="0%"
              x2="100%"
              y2="0%"
            >
              <stop offset="0%" stopColor="var(--color-accent)" stopOpacity={0.16} />
              <stop offset="100%" stopColor="var(--color-accent)" stopOpacity={0.62} />
            </linearGradient>
          </defs>
          <path
            d={FILL_PATH}
            fill="url(#phase-picker-fill-gradient)"
            stroke="var(--color-accent-700)"
            strokeWidth={1}
          />
        </svg>

        <div
          className="phase-picker-guideline"
          style={{
            left: `${tickPercent}%`,
            top: FILL_SVG_TOP,
            height: FILL_SVG_HEIGHT,
            transitionDuration: `${transitionMs}ms`,
          }}
        />

        <div
          className="phase-picker-callout"
          style={{ left: `${tickPercent}%`, transitionDuration: `${transitionMs}ms` }}
        >
          <div className="phase-picker-callout-ratio">{`×${fmt(ratio)}`}</div>
          <div className="phase-picker-callout-bar">
            <div
              className="phase-picker-callout-bar-fill"
              style={{ left: `${barLeft}%`, right: `${barRight}%` }}
            />
          </div>
          <div className="phase-picker-callout-range">
            <span>{`${fmt(phase.lowMult)}×`}</span>
            <span>{`${fmt(phase.highMult)}×`}</span>
          </div>
        </div>

        <div
          className="phase-picker-connector"
          style={{
            left: `${tickPercent}%`,
            top: CONNECTOR_TOP,
            height: CONNECTOR_HEIGHT_LARGE,
            transitionDuration: `${transitionMs}ms`,
          }}
        />

        <svg
          viewBox="0 0 560 90"
          preserveAspectRatio="none"
          className="phase-picker-axis"
          style={{ top: SVG_TOP_LARGE, height: 90 }}
        >
          <line x1={0} y1={90} x2={560} y2={90} className="phase-picker-axis-baseline" />
          <line x1={0} y1={80} x2={0} y2={100} className="phase-picker-axis-tick" />
          <line x1={140} y1={80} x2={140} y2={100} className="phase-picker-axis-tick" />
          <line x1={280} y1={80} x2={280} y2={100} className="phase-picker-axis-tick" />
          <line x1={420} y1={80} x2={420} y2={100} className="phase-picker-axis-tick" />
          <line x1={560} y1={80} x2={560} y2={100} className="phase-picker-axis-tick" />
        </svg>

        <svg
          viewBox="0 0 560 90"
          preserveAspectRatio="none"
          className="phase-picker-cone"
          style={{ top: UPPER_CURVE_TOP, height: 90 }}
        >
          <path
            d={CONE_PATH_LARGE}
            fill="none"
            stroke="var(--color-neutral-400)"
            strokeWidth={1.5}
            transform={`translate(0 ${PATH_SHIFT})`}
          />
        </svg>
        <svg
          viewBox="0 0 560 90"
          preserveAspectRatio="none"
          className="phase-picker-cone phase-picker-cone--mirror"
          style={{ top: MIRROR_TOP, height: 90 }}
        >
          <path
            d={CONE_PATH_LARGE}
            fill="none"
            stroke="var(--color-neutral-400)"
            strokeWidth={1.5}
            transform={`translate(0 ${PATH_SHIFT})`}
          />
        </svg>

        {PHASES.map((_, i) => (
          <button
            key={i}
            type="button"
            className={[
              'phase-picker-step-dot',
              i === index && 'phase-picker-step-dot--active',
            ]
              .filter(Boolean)
              .join(' ')}
            style={{ left: `${i * 25}%`, top: DIAMOND_TOP_LARGE }}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => snapTo(i)}
            aria-label={PHASES[i]!.label}
          />
        ))}

        <div
          className="phase-picker-diamond"
          style={{
            left: `${tickPercent}%`,
            top: DIAMOND_TOP_LARGE,
            transitionDuration: `${transitionMs}ms`,
          }}
        />
      </div>

      <button
        type="button"
        className={['phase-picker-nudge', index === 0 && 'phase-picker-nudge--hidden']
          .filter(Boolean)
          .join(' ')}
        style={{ left: 6, top: DIAMOND_TOP_LARGE }}
        onClick={() => snapTo(index - 1)}
        aria-label="Previous phase"
        aria-disabled={index === 0}
      >
        <CaretLeftIcon size={16} weight="bold" />
      </button>
      <button
        type="button"
        className={['phase-picker-nudge', index === 4 && 'phase-picker-nudge--hidden']
          .filter(Boolean)
          .join(' ')}
        style={{ right: 6, top: DIAMOND_TOP_LARGE }}
        onClick={() => snapTo(index + 1)}
        aria-label="Next phase"
        aria-disabled={index === 4}
      >
        <CaretRightIcon size={16} weight="bold" />
      </button>

      <div className="phase-picker-labels" style={{ top: AXIS_LABEL_TOP }}>
        {PHASES.map((p, i) => (
          <span
            key={i}
            className={['phase-picker-label', i === index && 'phase-picker-label--active']
              .filter(Boolean)
              .join(' ')}
          >
            {p.label}
          </span>
        ))}
      </div>
    </div>
  )
}
