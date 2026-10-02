import { ListChecksIcon } from '@phosphor-icons/react/dist/csr/ListChecks'
import { CardBody, CardTitle } from '../../../shared/ui'

interface WorkspaceEmptyStateProps {
  itemCount: number
  allFinalized: boolean
}

/** Shown in the detail column when no item is selected. */
export function WorkspaceEmptyState({
  itemCount,
  allFinalized,
}: WorkspaceEmptyStateProps) {
  const title =
    itemCount === 0
      ? 'Add an item to get started'
      : allFinalized
        ? 'All items finalized'
        : 'Select an item to estimate'
  const body =
    itemCount === 0
      ? "Everything you're estimating lives in the list on the left. Add one, then select it here to record a best / likely / worst range."
      : allFinalized
        ? 'Every item has a recorded range — open the summary from the sidebar, or add another item.'
        : 'Pick an item from the list on the left to record its best / likely / worst range.'

  return (
    <div className="workspace-empty-col">
      <ListChecksIcon size={28} style={{ color: 'var(--color-neutral-500)' }} />
      <CardTitle style={{ marginTop: 'var(--space-2)' }}>{title}</CardTitle>
      <CardBody style={{ maxWidth: 320 }}>{body}</CardBody>
    </div>
  )
}
