import { UserIcon } from '@phosphor-icons/react/dist/csr/User'
import { UsersThreeIcon } from '@phosphor-icons/react/dist/csr/UsersThree'
import { SignInIcon } from '@phosphor-icons/react/dist/csr/SignIn'
import { BrandMark, CardMeta, Tag } from '../../../shared/ui'
import { useNavigate } from 'react-router'
import { ROUTES } from '../../../shared/lib/routes'
import {
  useStartSingleUser,
  useStartCollaborative,
} from '../../../features/session-lifecycle'
import { ModeRow } from './ModeRow'

export function ModeSelect() {
  const startSingleUser = useStartSingleUser()
  const startCollaborative = useStartCollaborative()
  const navigate = useNavigate()

  return (
    <div
      style={{
        maxWidth: 620,
        margin: '0 auto',
        minHeight: 'calc(100vh - var(--header-height))',
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
        <BrandMark width={46} height={34} />
        <div style={{ textAlign: 'center' }}>
          <h1 style={{ margin: 0, fontSize: 32 }}>EstiMate</h1>
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
          onClick={startCollaborative}
        />
        <ModeRow
          icon={<SignInIcon size={22} />}
          title="Join a collaborative session"
          description="Enter a code your facilitator shared."
          onClick={() => navigate(ROUTES.join)}
        />
      </div>

      <CardMeta
        style={{
          flexDirection: 'column',
          alignItems: 'center',
          gap: 'var(--space-2)',
          textAlign: 'center',
        }}
      >
        <Tag variant="outline">Preview build {__APP_VERSION__}</Tag>
        <span>Estimates aren&rsquo;t saved yet, and live mode is still in progress.</span>
      </CardMeta>
    </div>
  )
}
