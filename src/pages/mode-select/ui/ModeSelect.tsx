import { UserIcon } from '@phosphor-icons/react/dist/csr/User'
import { UsersThreeIcon } from '@phosphor-icons/react/dist/csr/UsersThree'
import { SignInIcon } from '@phosphor-icons/react/dist/csr/SignIn'
import { FolderOpenIcon } from '@phosphor-icons/react/dist/csr/FolderOpen'
import { BrandMark, CardMeta, Tag } from '../../../shared/ui'
import { useNavigate } from 'react-router'
import { ROUTES } from '../../../shared/lib/routes'
import {
  useStartSingleUser,
  useStartCollaborative,
} from '../../../features/session-lifecycle'
import {
  LoadedSessionCard,
  LoadRejectedAlert,
  useSessionFileLoader,
} from '../../../features/session-persistence'
import { useSessionStore } from '../../../application'
import { ModeRow } from './ModeRow'

export function ModeSelect() {
  const startSingleUser = useStartSingleUser()
  const startCollaborative = useStartCollaborative()
  const navigate = useNavigate()
  const sessionName = useSessionStore((s) => s.sessionName)
  const { chooseFile, fileInputProps, loadedFileName, rejection, discard } =
    useSessionFileLoader()
  const loaded = loadedFileName !== null
  const continuing = sessionName || 'this session'

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
        {loaded && (
          <>
            <LoadedSessionCard fileName={loadedFileName} onDiscard={discard} />
            <span className="text-muted" style={{ fontSize: 12, padding: '6px 2px 0' }}>
              Continue this session:
            </span>
          </>
        )}
        <ModeRow
          icon={<UserIcon size={22} />}
          title="Start single-user mode"
          description={
            loaded
              ? `Continue ${continuing} on your own.`
              : 'Estimate on your own, at your own pace.'
          }
          onClick={startSingleUser}
        />
        <ModeRow
          icon={<UsersThreeIcon size={22} />}
          title="Start collaborative estimation"
          description={
            loaded
              ? `Continue ${continuing} live with your team.`
              : 'Generate a code and estimate live with your team.'
          }
          onClick={startCollaborative}
        />
        {!loaded && (
          <>
            <ModeRow
              icon={<SignInIcon size={22} />}
              title="Join a collaborative session"
              description="Enter a code your facilitator shared."
              onClick={() => navigate(ROUTES.join)}
            />
            <ModeRow
              icon={<FolderOpenIcon size={22} />}
              title="Load a saved session"
              description="Continue from a .estimate.json file you saved earlier."
              onClick={chooseFile}
            />
          </>
        )}
        <input {...fileInputProps} />
        <LoadRejectedAlert rejection={rejection} />
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
        <span>Sessions aren&rsquo;t kept in the browser. Save a file to keep one.</span>
      </CardMeta>
    </div>
  )
}
