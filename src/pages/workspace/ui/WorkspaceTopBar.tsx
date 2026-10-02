import { useNavigate } from 'react-router'
import { PencilSimpleIcon } from '@phosphor-icons/react/dist/csr/PencilSimple'
import { NotebookIcon } from '@phosphor-icons/react/dist/csr/Notebook'
import { Button, Input, Select } from '../../../shared/ui'
import { ROUTES } from '../../../shared/lib/routes'
import { useSessionStore } from '../../../entities/session'
import type { EstimationUnit } from '../../../entities/estimate'

/** The merged card's top bar: editable session name, estimation unit, and the
 *  Summary shortcut. */
export function WorkspaceTopBar() {
  const sessionName = useSessionStore((s) => s.sessionName)
  const unit = useSessionStore((s) => s.unit)
  const setSessionName = useSessionStore((s) => s.setSessionName)
  const setUnit = useSessionStore((s) => s.setUnit)
  const navigate = useNavigate()

  return (
    <div className="workspace-topbar">
      <Input
        aria-label="Session name"
        value={sessionName}
        onChange={(e) => setSessionName(e.target.value)}
        placeholder="Untitled session"
        style={{
          fontFamily: 'var(--font-heading)',
          fontSize: 15,
          fontWeight: 500,
          border: 'none',
          background: 'transparent',
          padding: 0,
          height: 'auto',
          flex: 'none',
          width: 'auto',
          minWidth: 120,
        }}
      />
      <PencilSimpleIcon
        size={12}
        style={{ color: 'var(--color-neutral-500)', flex: 'none' }}
      />
      <span className="text-muted" style={{ fontSize: 12, flex: 'none' }}>
        ·
      </span>
      <Select
        aria-label="Estimation unit"
        value={unit}
        onChange={(e) => setUnit(e.target.value as EstimationUnit)}
        style={{
          height: 22,
          fontSize: 12,
          padding: '0 4px',
          width: 'auto',
          flex: 'none',
        }}
      >
        <option value="hours">Hours</option>
        <option value="days">Days</option>
        <option value="weeks">Weeks</option>
      </Select>
      <span style={{ flex: 1 }} />
      <Button variant="ghost" onClick={() => navigate(ROUTES.summary)}>
        <NotebookIcon size={15} />
        Summary
      </Button>
    </div>
  )
}
