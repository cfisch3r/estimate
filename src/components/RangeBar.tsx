interface RangeBarProps {
  min: number
  max: number
  expected: number
  ci90: number
  unitSuffix: string
}

function formatValue(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1)
}

export function RangeBar({ min, max, expected, ci90, unitSuffix }: RangeBarProps) {
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
        <div
          className="range-bar-callout range-bar-callout--accent"
          style={{ left: `${ci90Pct}%` }}
        >
          <div className="range-bar-callout-value">{`${formatValue(ci90)}${unitSuffix}`}</div>
          <div className="range-bar-callout-caption">90% confidence</div>
        </div>
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
        <div
          data-testid="range-bar-marker-ci90"
          className="range-bar-marker"
          style={{ left: `${ci90Pct}%` }}
        />
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
    </div>
  )
}
