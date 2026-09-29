import type { ReactNode } from 'react'
import { Field, FieldLabel, Textarea } from '../../../shared/ui/Field'
import type { Item } from '../model/types'
import { EditableTitle } from './EditableTitle'
import { DescriptionField } from './DescriptionField'

interface ItemDetailShellProps {
  item: Item
  onNotesChange: (id: string, notes: string) => void
  onDescriptionChange: (id: string, description: string) => void
  onTitleChange: (id: string, title: string) => void
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
  onNotesChange,
  onDescriptionChange,
  onTitleChange,
  descriptionInfoOpen,
  onDescriptionInfoOpen,
  onDescriptionInfoClose,
  children,
}: ItemDetailShellProps) {
  return (
    <>
      <EditableTitle
        value={item.title}
        onCommit={(next) => onTitleChange(item.id, next)}
      />
      <DescriptionField
        value={item.description}
        onChange={(next) => onDescriptionChange(item.id, next)}
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
          onChange={(e) => onNotesChange(item.id, e.target.value)}
          style={{ flex: 1, minHeight: 0, resize: 'vertical' }}
        />
      </Field>
    </>
  )
}
