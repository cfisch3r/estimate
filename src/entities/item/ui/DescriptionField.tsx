import { MarkdownEditor } from '../../../shared/ui'
import { DESCRIPTION_INFO } from '../../../shared/copy'

interface DescriptionFieldProps {
  value: string
  onChange: (next: string) => void
  infoOpen: boolean
  onInfoOpen: () => void
  onInfoClose: () => void
}

/** The item description, edited as markdown — a `MarkdownEditor` carrying the
 *  description copy; the editing behaviour itself lives in `shared/ui`. */
export function DescriptionField(props: DescriptionFieldProps) {
  return <MarkdownEditor label="Description" info={DESCRIPTION_INFO} {...props} />
}
