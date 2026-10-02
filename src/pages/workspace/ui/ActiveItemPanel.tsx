import { Button, NavRow } from '../../../shared/ui'
import { useSingleInfoPopover } from '../../../shared/lib/useSingleInfoPopover'
import {
  ItemDetailShell,
  type FinalizeResult,
  type Item,
} from '../../../entities/session'
import type { EstimationUnit } from '../../../entities/estimate'
import { ThreePointEstimateForm } from '../../../features/estimate-round'

interface ActiveItemPanelProps {
  item: Item
  unit: EstimationUnit
  isFirst: boolean
  isLast: boolean
  onFinalize: (id: string, best: number, likely: number, worst: number) => FinalizeResult
  onAdvance: () => void
  onNavigatePrev: () => void
}

export function ActiveItemPanel({
  item,
  unit,
  isFirst,
  isLast,
  onFinalize,
  onAdvance,
  onNavigatePrev,
}: ActiveItemPanelProps) {
  const isEdit = item.finalResult !== null
  const info = useSingleInfoPopover<'description' | 'estimate' | 'phase' | 'range'>()

  const primaryLabel = isEdit
    ? isLast
      ? 'Update & view summary'
      : 'Update & next →'
    : isLast
      ? 'Finalize & view summary'
      : 'Finalize & next →'

  return (
    <ItemDetailShell
      item={item}
      descriptionInfoOpen={info.openKey === 'description'}
      onDescriptionInfoOpen={() => info.open('description')}
      onDescriptionInfoClose={info.close}
    >
      <ThreePointEstimateForm
        unit={unit}
        initial={
          item.finalResult
            ? {
                best: item.finalResult.min,
                likely: item.finalResult.expected,
                worst: item.finalResult.max,
              }
            : null
        }
        info={info}
        footer={({ valid, best, likely, worst }) => (
          <NavRow isFirst={isFirst} onNavigatePrev={onNavigatePrev}>
            <Button
              variant="primary"
              style={{ flex: 1 }}
              disabled={!valid}
              onClick={() => {
                const result = onFinalize(item.id, best, likely, worst)
                if (result.ok) onAdvance()
              }}
            >
              {valid ? primaryLabel : isEdit ? 'Update item' : 'Finalize item'}
            </Button>
          </NavRow>
        )}
      />
    </ItemDetailShell>
  )
}
