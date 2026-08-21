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
  const ci90Pct = pct(ci90)

  return (
    <div className="range-bar">
      <div className="range-bar-track">
        <div className="range-bar-fill-wrap">
          <div className="range-bar-confident" style={{ width: `${expectedPct}%` }} />
          <div
            className="range-bar-uncertain"
            style={{ width: `${100 - expectedPct}%` }}
          />
        </div>
        <div
          className="range-bar-tick range-bar-tick--ci90"
          style={{ left: `${ci90Pct}%` }}
        />
        <div
          className="range-bar-tick range-bar-tick--expected"
          style={{ left: `${expectedPct}%` }}
        />
        <div
          className="range-bar-caption"
          style={{ left: `${ci90Pct}%` }}
        >{`${formatValue(ci90)}${unitSuffix}`}</div>
        <div
          className="range-bar-value"
          style={{ left: `${expectedPct}%` }}
        >{`${formatValue(expected)}${unitSuffix}`}</div>
      </div>
      <div className="range-bar-ends">
        <span>{`${formatValue(min)}${unitSuffix} best`}</span>
        <span>{`${formatValue(max)}${unitSuffix} worst`}</span>
      </div>
    </div>
  )
}
