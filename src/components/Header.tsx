import { ChatTeardropTextIcon } from '@phosphor-icons/react/dist/csr/ChatTeardropText'
import { useSessionStore } from '../state/store'
import type { ScreenId } from '../state/types'
import { useConfirmArm } from '../hooks/useConfirmArm'
import { useLeaveWorkspace } from '../hooks/useLeaveWorkspace'
import { Tag } from './Tag'

const EXIT_SCREENS = new Set<ScreenId>(['workspace', 'summary', 'history'])
const FEEDBACK_URL =
  'https://github.com/cfisch3r/estimate/issues/new?template=feedback.yml'

function BrandMark() {
  return (
    <svg width="30" height="22" viewBox="0 0 22 16" fill="none" aria-hidden="true">
      <line
        x1="1"
        y1="8"
        x2="21"
        y2="8"
        stroke="var(--color-divider)"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <line
        x1="1"
        y1="4"
        x2="1"
        y2="12"
        stroke="var(--color-neutral-400)"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <line
        x1="21"
        y1="4"
        x2="21"
        y2="12"
        stroke="var(--color-neutral-400)"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <line
        x1="12"
        y1="1"
        x2="12"
        y2="15"
        stroke="var(--color-accent)"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    </svg>
  )
}

export function Header() {
  const currentScreen = useSessionStore((s) => s.currentScreen)
  const mode = useSessionStore((s) => s.mode)
  const peerCount = useSessionStore((s) => s.peerCount)
  const leaveWorkspace = useLeaveWorkspace()
  const {
    armed,
    handleClick: armAndLeave,
    ref: leaveRef,
  } = useConfirmArm<HTMLButtonElement>(leaveWorkspace)

  const showModeTag = currentScreen !== 'mode-select' && currentScreen !== 'join'
  const canLeave = EXIT_SCREENS.has(currentScreen)
  const needsConfirm = mode === 'live' && peerCount > 0

  return (
    <header className="app-header">
      <div className="app-header-start">
        {canLeave ? (
          <button
            ref={leaveRef}
            type="button"
            className="app-header-brand app-header-brand-home"
            aria-label={
              needsConfirm && armed
                ? 'Click again to leave session'
                : 'Back to mode selection'
            }
            style={{ color: needsConfirm && armed ? 'var(--color-warning)' : undefined }}
            onClick={needsConfirm ? armAndLeave : leaveWorkspace}
          >
            <BrandMark />
            {needsConfirm && armed ? 'Click again to leave session' : 'EstiMate'}
          </button>
        ) : (
          <span className="app-header-brand">
            <BrandMark />
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
