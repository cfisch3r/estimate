import type { ReactNode } from 'react'
import { UserIcon } from '@phosphor-icons/react/dist/csr/User'
import { UsersThreeIcon } from '@phosphor-icons/react/dist/csr/UsersThree'
import { SignInIcon } from '@phosphor-icons/react/dist/csr/SignIn'
import { ArrowRightIcon } from '@phosphor-icons/react/dist/csr/ArrowRight'
import { Card, CardTitle, CardMeta } from '../components'
import { useSessionStore } from '../state/store'
import { generateSessionCode, useNetworkSession } from '../network'

function BrandMark() {
  return (
    <svg width="46" height="34" viewBox="0 0 22 16" fill="none" aria-hidden="true">
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

interface ModeRowProps {
  icon: ReactNode
  title: string
  description: string
  onClick: () => void
}

function ModeRow({ icon, title, description, onClick }: ModeRowProps) {
  return (
    <Card
      elevation="sm"
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onClick()
        }
      }}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 'var(--space-4)',
        padding: 'var(--space-4)',
        cursor: 'pointer',
      }}
    >
      <span
        style={{
          fontSize: 22,
          color: 'var(--color-accent-300)',
          flex: 'none',
          display: 'flex',
        }}
      >
        {icon}
      </span>
      <span style={{ flex: 1 }}>
        <CardTitle style={{ display: 'block' }}>{title}</CardTitle>
        <CardMeta style={{ display: 'block' }}>{description}</CardMeta>
      </span>
      <ArrowRightIcon
        size={16}
        style={{ color: 'var(--color-neutral-500)', flex: 'none' }}
      />
    </Card>
  )
}

export function ModeSelect() {
  const startSingleUser = useSessionStore((s) => s.startSingleUser)
  const startCollaborative = useSessionStore((s) => s.startCollaborative)
  const goToScreen = useSessionStore((s) => s.goToScreen)
  const { connect } = useNetworkSession()

  function handleCollaborative() {
    const code = generateSessionCode()
    startCollaborative(code)
    connect(code)
  }

  return (
    <div
      style={{
        maxWidth: 620,
        margin: '0 auto',
        minHeight: '70vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 'var(--space-8)',
        padding: 'var(--space-6)',
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 'var(--space-4)',
        }}
      >
        <BrandMark />
        <div style={{ textAlign: 'center' }}>
          <div
            style={{ fontFamily: 'var(--font-heading)', fontWeight: 500, fontSize: 26 }}
          >
            EstiMate
          </div>
          <p className="text-muted" style={{ margin: '8px 0 0', fontSize: 15 }}>
            Three-point estimation for software teams, alone or together.
          </p>
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-3)',
          width: '100%',
          maxWidth: 420,
        }}
      >
        <ModeRow
          icon={<UserIcon size={22} />}
          title="Start single-user mode"
          description="Estimate on your own, at your own pace."
          onClick={startSingleUser}
        />
        <ModeRow
          icon={<UsersThreeIcon size={22} />}
          title="Start collaborative estimation"
          description="Generate a code and estimate live with your team."
          onClick={handleCollaborative}
        />
        <ModeRow
          icon={<SignInIcon size={22} />}
          title="Join a collaborative session"
          description="Enter a code your facilitator shared."
          onClick={() => goToScreen('join')}
        />
      </div>
    </div>
  )
}
