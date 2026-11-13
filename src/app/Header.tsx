import { useLocation } from 'react-router'
import { ChatTeardropTextIcon } from '@phosphor-icons/react/dist/csr/ChatTeardropText'
import './header.css'
import { BrandMark, Tag } from '../shared/ui'
import { useConfirmArm } from '../shared/lib/useConfirmArm'
import { useConnectionStore } from '../application'
import { useLeaveWorkspace } from '../features/session-lifecycle'
import { ROUTES } from '../shared/lib/routes'

const EXIT_PATHS = new Set<string>([ROUTES.workspace, ROUTES.summary, ROUTES.history])
/** The armed brand's text per reason for a second click. */
const ARMED_LABEL = {
  unsaved: 'Unsaved changes, click again to leave',
  'live-peers': 'Click again to leave session',
} as const

const FEEDBACK_URL =
  'https://github.com/cfisch3r/estimate/issues/new?template=feedback.yml'

export function Header() {
  const location = useLocation()
  const mode = useConnectionStore((s) => s.mode)
  const { leaveWorkspace, confirmation } = useLeaveWorkspace()
  const {
    armed,
    handleClick: armAndLeave,
    ref: leaveRef,
  } = useConfirmArm<HTMLButtonElement>(leaveWorkspace)

  const showModeTag =
    location.pathname !== ROUTES.modeSelect && location.pathname !== ROUTES.join
  const canLeave = EXIT_PATHS.has(location.pathname)
  const armedLabel = confirmation !== 'none' && armed ? ARMED_LABEL[confirmation] : null

  return (
    <header className="app-header">
      <div className="app-header-start">
        {canLeave ? (
          <button
            ref={leaveRef}
            type="button"
            className="app-header-brand app-header-brand-home"
            aria-label={armedLabel ?? 'Back to mode selection'}
            style={{ color: armedLabel ? 'var(--color-warning)' : undefined }}
            onClick={confirmation === 'none' ? leaveWorkspace : armAndLeave}
          >
            <BrandMark width={30} height={22} />
            {armedLabel ?? 'EstiMate'}
          </button>
        ) : (
          <span className="app-header-brand">
            <BrandMark width={30} height={22} />
            EstiMate
          </span>
        )}
        <a
          className="app-header-feedback"
          href={FEEDBACK_URL}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Send feedback"
          title="Send feedback"
        >
          <ChatTeardropTextIcon size={18} />
        </a>
      </div>
      {showModeTag &&
        (mode === 'live' ? (
          <Tag variant="accent">Live</Tag>
        ) : (
          <Tag variant="neutral">Single-user</Tag>
        ))}
    </header>
  )
}
