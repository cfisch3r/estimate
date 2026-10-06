import type { HTMLAttributes, ReactNode, Ref } from 'react'
import { InfoPopover } from './InfoPopover'
import './group-box.css'

interface GroupBoxProps extends HTMLAttributes<HTMLDivElement> {
  label: string
  info?: ReactNode
  infoOpen?: boolean
  onInfoOpen?: () => void
  onInfoClose?: () => void
  children: ReactNode
  /** The label text, e.g. as a programmatic focus target: when given it is
   *  focusable by script only (tabindex -1), never by Tab. */
  labelRef?: Ref<HTMLSpanElement>
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
  labelRef,
  ...props
}: GroupBoxProps) {
  return (
    <div className={['group-box', className].filter(Boolean).join(' ')} {...props}>
      <div className="group-box-label">
        <span ref={labelRef} tabIndex={labelRef ? -1 : undefined}>
          {label}
        </span>
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
