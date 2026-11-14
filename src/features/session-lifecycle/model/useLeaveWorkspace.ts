import { useNavigate } from 'react-router'
import { useCloseWorkspace } from '../../../application'
import type { LeaveConfirmation } from '../../../domain/connection'
import { ROUTES } from '../../../shared/lib/routes'

/** Leave the workspace and navigate to mode-select (see `useCloseWorkspace`). */
export function useLeaveWorkspace(): {
  leaveWorkspace: () => void
  confirmation: LeaveConfirmation
} {
  const { closeWorkspace, confirmation } = useCloseWorkspace()
  const navigate = useNavigate()

  return {
    leaveWorkspace: () => {
      closeWorkspace()
      navigate(ROUTES.modeSelect)
    },
    confirmation,
  }
}
