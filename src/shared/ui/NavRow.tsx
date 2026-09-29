import type { ReactNode } from 'react'
import { CaretLeftIcon } from '@phosphor-icons/react/dist/csr/CaretLeft'
import { Button } from './Button'

interface NavRowProps {
  isFirst: boolean
  onNavigatePrev: () => void
  children: ReactNode
}

/** The "← + primary advance action" row shared by every item-detail panel: ←
 *  only ever navigates to the adjacent item (never a finalize side effect),
 *  the primary button (passed as `children`) does the finalize/advance. */
export function NavRow({ isFirst, onNavigatePrev, children }: NavRowProps) {
  return (
    <div className="workspace-navrow">
      <Button
        icon
        variant="secondary"
        aria-label="Previous item"
        disabled={isFirst}
        onClick={onNavigatePrev}
      >
        <CaretLeftIcon size={16} />
      </Button>
      {children}
    </div>
  )
}
