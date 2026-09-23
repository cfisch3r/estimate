import { formatValue } from './format'
import { GuardNote } from './GuardNote'

interface RangeBarProps {
  min: number
  max: number
  expected: number
  ci90: number
  unitSuffix: string
  /** When set, the bar also shows the cone-of-uncertainty guidance ceiling (PRD
   *  §6.1) — the caller computes it (`bestCase * highMult/lowMult`, anchored to
   *  Best Case) once via `usePhaseGuidance` and passes the number through, so the
   *  formula lives in exactly one place. Omitted entirely, the bar renders exactly
   *  as it always has. */
  guidance?: { guidanceHigh: number }
}

/** Minimum gap (as a % of track width) kept between the expected and 90%-confidence
 *  markers/callouts so their boxes never overlap — ported from the design handoff's
 *  `90 / 560` reference constant. */
const MIN_GAP_PCT = (90 / 560) * 100

/** Minimum distance (%) the below-track "most likely" label keeps from either edge
 *  label, so it never collides with best case or worst case. */
const MIN_SEP_BELOW = 14

/** Fixed width (%) the track renders at when the entered range is narrower than the
 *  guidance ceiling — keeps the four real markers at a legible, constant scale no
 *  matter how extreme the guidance ratio gets. */
const COMPRESSED_CAP = 78

/** Pushes the two markers apart around their midpoint when they'd collide, then
 *  clamps back into [0, cap] — re-centering alone can otherwise push a marker
 *  past either edge when the pair sits close to 0% or cap%. */
function pushApart(expectedPct: number, ci90Pct: number, cap: number): [number, number] {
  if (ci90Pct - expectedPct >= MIN_GAP_PCT) {
    return [expectedPct, ci90Pct]
  }
  const mid = (ci90Pct + expectedPct) / 2
  const pushedExpected = mid - MIN_GAP_PCT / 2
  const pushedCi90 = mid + MIN_GAP_PCT / 2
  if (pushedExpected < 0) {
    return [0, MIN_GAP_PCT]
  }
  if (pushedCi90 > cap) {
    return [cap - MIN_GAP_PCT, cap]
  }
  return [pushedExpected, pushedCi90]
}

function clampLikelyLabelPct(pct: number, worstPct: number): number {
  let result = pct
  if (result < MIN_SEP_BELOW) {
    result = MIN_SEP_BELOW
  }
  if (worstPct - result < MIN_SEP_BELOW) {
    result = worstPct - MIN_SEP_BELOW
  }
  return result
}

/** McConnell's formula treats (worst-best)/3 as the distribution's standard
 *  deviation and adds 1.28 of it — the 90th-percentile z-score — on top of "most
 *  likely," assuming most likely sits closer to best than to worst (the usual
 *  positive skew for software tasks). If most likely sits close to worst instead,
 *  that offset can push past worst case: not a formula bug, but the formula
 *  flagging that most likely is too high for the declared spread to support a P90
 *  point inside it. That number isn't meaningful to show on the bar at that point,
 *  so the marker/callout are hidden and this note takes their place. */
function Ci90ExceedsWorstWarning() {
  return (
    <GuardNote>
      Can&rsquo;t compute 90% confidence — most likely is too close to worst case for this
      spread. Try lowering most likely or giving worst case more room.
    </GuardNote>
  )
}

export function RangeBar({
  min,
  max,
  expected,
  ci90,
  unitSuffix,
  guidance,
}: RangeBarProps) {
  if (!guidance) {
    const ci90ExceedsWorst = ci90 >= max
    const span = max - min
    const pct = (value: number) =>
      span <= 0 ? 50 : Math.min(100, Math.max(0, ((value - min) / span) * 100))
    const expectedPct = pct(expected)
    const ci90Pct = Math.max(expectedPct, Math.min(pct(ci90), 80))

    return (
      <div className="range-bar">
        <div className="range-bar-track-box">
          <div
            className="range-bar-callout range-bar-callout--muted"
            style={{ left: `${expectedPct}%` }}
          >
            <div className="range-bar-callout-value">{`${formatValue(expected)}${unitSuffix}`}</div>
            <div className="range-bar-callout-caption">most likely</div>
          </div>
          {!ci90ExceedsWorst && (
            <div
              className="range-bar-callout range-bar-callout--accent"
              style={{ left: `${ci90Pct}%` }}
            >
              <div className="range-bar-callout-value">{`${formatValue(ci90)}${unitSuffix}`}</div>
              <div className="range-bar-callout-caption">90% confidence</div>
            </div>
          )}
          <div className="range-bar-track">
            <div
              className="range-bar-segment range-bar-segment--uncertain"
              style={{ width: `${expectedPct}%` }}
            />
            <div
              className="range-bar-segment range-bar-segment--likely"
              style={{ width: `${ci90Pct - expectedPct}%` }}
            />
            <div
              className="range-bar-segment range-bar-segment--confident"
              style={{ width: `${100 - ci90Pct}%` }}
            />
          </div>
          <div
            data-testid="range-bar-marker-expected"
            className="range-bar-marker"
            style={{ left: `${expectedPct}%` }}
          />
          {!ci90ExceedsWorst && (
            <div
              data-testid="range-bar-marker-ci90"
              className="range-bar-marker"
              style={{ left: `${ci90Pct}%` }}
            />
          )}
        </div>
        <div className="range-bar-ends">
          <div className="range-bar-end">
            <span className="range-bar-end-value">{`${formatValue(min)}${unitSuffix}`}</span>
            <span className="range-bar-end-caption">best case</span>
          </div>
          <div className="range-bar-end range-bar-end--right">
            <span className="range-bar-end-value">{`${formatValue(max)}${unitSuffix}`}</span>
            <span className="range-bar-end-caption">worst case</span>
          </div>
        </div>
        {ci90ExceedsWorst && <Ci90ExceedsWorstWarning />}
      </div>
    )
  }

  return max < guidance.guidanceHigh ? (
    <CompressedRangeBar
      min={min}
      max={max}
      expected={expected}
      ci90={ci90}
      unitSuffix={unitSuffix}
      guidanceHigh={guidance.guidanceHigh}
    />
  ) : (
    <FullRangeBar
      min={min}
      max={max}
      expected={expected}
      ci90={ci90}
      unitSuffix={unitSuffix}
      guidanceHigh={guidance.guidanceHigh}
    />
  )
}

interface GuidedRangeBarProps {
  min: number
  max: number
  expected: number
  ci90: number
  unitSuffix: string
  guidanceHigh: number
}

/** Shared rendering for both guided states — they differ only in where the track
 *  caps out (`compressed` narrows it to COMPRESSED_CAP with a ghost tail; the full
 *  state uses the true 0-100% scale) and how the ceiling itself is drawn (a boxed
 *  callout vs. a plain in-track tick). See
 *  design_handoffs/design_handoff_uncertainty_range/README.md screen 2, states 9a/9b. */
function GuidedRangeBar({
  min,
  max,
  expected,
  ci90,
  unitSuffix,
  guidanceHigh,
  compressed,
}: GuidedRangeBarProps & { compressed: boolean }) {
  const cap = compressed ? COMPRESSED_CAP : 100
  const ci90ExceedsWorst = ci90 >= max
  const span = max - min
  const pct = (value: number) =>
    span <= 0 ? 50 : Math.min(cap, Math.max(0, ((value - min) / span) * cap))

  const rawExpectedPct = pct(expected)
  const rawCi90Pct = Math.max(rawExpectedPct, Math.min(pct(ci90), cap))
  const [expectedPct, ci90Pct] = ci90ExceedsWorst
    ? [rawExpectedPct, rawCi90Pct]
    : pushApart(rawExpectedPct, rawCi90Pct, cap)

  const worstPct = cap
  const breakPct = worstPct + 3
  const likelyLabelPct = clampLikelyLabelPct(pct(expected), worstPct)
  const ceilingPct = pct(guidanceHigh)

  return (
    <div className="range-bar">
      <div className="range-bar-track-box">
        {!ci90ExceedsWorst && (
          <div
            className="range-bar-callout range-bar-callout--accent"
            style={{ left: `${ci90Pct}%` }}
          >
            <div className="range-bar-callout-value">{`${formatValue(ci90)}${unitSuffix}`}</div>
            <div className="range-bar-callout-caption">90% confidence</div>
          </div>
        )}
        {compressed && (
          <div className="ceiling-callout">
            <div className="range-bar-callout-value">{`${formatValue(guidanceHigh)}${unitSuffix}`}</div>
            <div className="range-bar-callout-caption">guidance ceiling</div>
          </div>
        )}
        <div className="range-bar-track">
          <div
            className="range-bar-segment range-bar-segment--uncertain"
            style={{ width: `${expectedPct}%` }}
          />
          <div
            className="range-bar-segment range-bar-segment--likely"
            style={{ width: `${ci90Pct - expectedPct}%` }}
          />
          <div
            className="range-bar-segment range-bar-segment--confident"
            style={{ width: `${worstPct - ci90Pct}%` }}
          />
          {compressed && (
            <div className="ghost-segment" style={{ width: `${100 - worstPct}%` }} />
          )}
        </div>
        {compressed && <div className="break-gap" style={{ left: `${breakPct}%` }} />}
        {!compressed && (
          <>
            <div className="ceiling-tick" style={{ left: `${ceilingPct}%` }} />
            <div className="ceiling-tick-label" style={{ left: `${ceilingPct}%` }}>
              {`${formatValue(guidanceHigh)}${unitSuffix} ceiling`}
            </div>
          </>
        )}
        <div
          data-testid="range-bar-marker-best"
          className="range-bar-marker"
          style={{ left: '0%' }}
        />
        <div
          data-testid="range-bar-marker-expected"
          className="range-bar-marker"
          style={{ left: `${expectedPct}%` }}
        />
        {!ci90ExceedsWorst && (
          <div
            data-testid="range-bar-marker-ci90"
            className="range-bar-marker"
            style={{ left: `${ci90Pct}%` }}
          />
        )}
        <div
          data-testid="range-bar-marker-worst"
          className="range-bar-marker"
          style={{ left: `${worstPct}%` }}
        />
      </div>
      <div className="range-bar-ends-guided">
        <div className="range-bar-end-guided" style={{ left: '0%' }}>
          <span className="range-bar-end-value">{`${formatValue(min)}${unitSuffix}`}</span>
          <span className="range-bar-end-caption">best case</span>
        </div>
        <div className="range-bar-mid-guided" style={{ left: `${likelyLabelPct}%` }}>
          <span className="range-bar-end-value">{`${formatValue(expected)}${unitSuffix}`}</span>
          <span className="range-bar-end-caption">most likely</span>
        </div>
        <div
          className="range-bar-end-guided range-bar-end-guided--right"
          style={{ right: `${100 - worstPct}%` }}
        >
          <span className="range-bar-end-value">{`${formatValue(max)}${unitSuffix}`}</span>
          <span className="range-bar-end-caption">worst case</span>
        </div>
      </div>
      {ci90ExceedsWorst && <Ci90ExceedsWorstWarning />}
    </div>
  )
}

/** Worst case narrower than guidance: the track caps its rendered width at a fixed
 *  78%, with the remaining 22% shown as a compressed "ghost" segment out to the
 *  guidance ceiling — design handoff state 9a. */
function CompressedRangeBar(props: GuidedRangeBarProps) {
  return <GuidedRangeBar {...props} compressed />
}

/** Worst case already meets/exceeds guidance: the track uses its full 0-100% width
 *  at true scale, with the ceiling shown as a plain tick wherever it falls —
 *  design handoff state 9b. */
function FullRangeBar(props: GuidedRangeBarProps) {
  return <GuidedRangeBar {...props} compressed={false} />
}
