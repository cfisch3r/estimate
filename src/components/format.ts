/** Shared value formatting for estimate figures shown in the UI (range bar
 *  markers/callouts, guidance notes): integers render bare, everything else to
 *  one decimal place. */
export function formatValue(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1)
}
