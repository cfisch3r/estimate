import type { ReactNode } from 'react'
import { Field, FieldLabel, Textarea, EditableTitle } from '../../../shared/ui'
import { useSessionStore } from '../../../application/stores/session'
import type { Item } from '../../../domain/types'
import { DescriptionField } from './DescriptionField'

interface ItemDetailShellProps {
  item: Item
  descriptionInfoOpen: boolean
  onDescriptionInfoOpen: () => void
  onDescriptionInfoClose: () => void
  children: ReactNode
}

/** The chrome shared by every active-item panel: the click-to-edit title, the
 *  description field, and the discussion-notes field. `children` is the
 *  mode-specific middle (manual inputs, or the facilitator reveal flow). Sits
 *  flush inside Workspace's merged card — no card/shadow of its own. */
export function ItemDetailShell({
  item,
  descriptionInfoOpen,
  onDescriptionInfoOpen,
  onDescriptionInfoClose,
  children,
}: ItemDetailShellProps) {
  const setItemTitle = useSessionStore((s) => s.setItemTitle)
  const setItemDescription = useSessionStore((s) => s.setItemDescription)
  const setItemNotes = useSessionStore((s) => s.setItemNotes)

  return (
    <>
      <EditableTitle
        value={item.title}
        onCommit={(next) => setItemTitle(item.id, next)}
      />
      <DescriptionField
        value={item.description}
        onChange={(next) => setItemDescription(item.id, next)}
        infoOpen={descriptionInfoOpen}
        onInfoOpen={onDescriptionInfoOpen}
        onInfoClose={onDescriptionInfoClose}
      />

      {children}

      <Field style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <FieldLabel htmlFor="notes">Notes (captured during discussion)</FieldLabel>
        <Textarea
          id="notes"
          rows={8}
          value={item.notes}
          onChange={(e) => setItemNotes(item.id, e.target.value)}
          style={{ flex: 1, minHeight: 0, resize: 'vertical' }}
        />
      </Field>
    </>
  )
}
