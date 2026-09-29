import type { HTMLAttributes, ReactNode } from 'react'
import { InfoPopover } from './InfoPopover'

interface GroupBoxProps extends HTMLAttributes<HTMLDivElement> {
  label: string
  info?: ReactNode
  infoOpen?: boolean
  onInfoOpen?: () => void
  onInfoClose?: () => void
  children: ReactNode
}

/** Bordered section with a heading and an optional click-to-open info icon —
 *  the shared wrapper for the three-point-estimate / phase / range / (live
 *  facilitator) participant-estimates groups across all three workspace
 *  screens. */
export function GroupBox({
  label,
  info,
  infoOpen = false,
  onInfoOpen,
  onInfoClose,
  children,
  className,
  ...props
}: GroupBoxProps) {
  return (
    <div className={['group-box', className].filter(Boolean).join(' ')} {...props}>
      <div className="group-box-label">
        <span>{label}</span>
        {info && (
          <InfoPopover
            label={`About ${label.toLowerCase()}`}
            open={infoOpen}
            onOpen={() => onInfoOpen?.()}
            onClose={() => onInfoClose?.()}
          >
            {info}
          </InfoPopover>
        )}
      </div>
      {children}
    </div>
  )
}
