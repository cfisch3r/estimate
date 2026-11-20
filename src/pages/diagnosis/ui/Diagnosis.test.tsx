import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axe } from 'jest-axe'
import type { useDiagnosisReport } from '../../../application'
import { Diagnosis } from './Diagnosis'

type DiagnosisReport = ReturnType<typeof useDiagnosisReport>

const report: DiagnosisReport = {
  available: true,
  report: 'EstiMate connection diagnosis\n…\n[ab12 participant] status  connected',
  download: vi.fn(),
  copy: vi.fn(() => Promise.resolve('copied' as const)),
  clear: vi.fn(),
}
let current: DiagnosisReport

vi.mock('../../../application/useCases/useDiagnosisReport', () => ({
  useDiagnosisReport: () => current,
}))

beforeEach(() => {
  vi.clearAllMocks()
  current = { ...report }
})

describe('Diagnosis', () => {
  it('shows the report read-only, with what to do with it', () => {
    render(<Diagnosis />)

    expect(
      screen.getByRole('heading', { name: 'Connection diagnosis' }),
    ).toBeInTheDocument()
    expect(
      screen.getByText(/send the file to the organiser directly/),
    ).toBeInTheDocument()
    const field = screen.getByLabelText('Diagnosis report')
    expect(field).toHaveValue(report.report)
    expect(field).toHaveAttribute('readonly')
  })

  it('says when this browser could not record anything', () => {
    current = { ...report, available: false }
    render(<Diagnosis />)
    expect(screen.getByText(/browser storage is blocked/)).toBeInTheDocument()
  })

  it('downloads the report', async () => {
    const user = userEvent.setup()
    render(<Diagnosis />)

    await user.click(screen.getByRole('button', { name: 'Download report' }))

    expect(report.download).toHaveBeenCalledTimes(1)
  })

  it('copies the report and confirms it', async () => {
    const user = userEvent.setup()
    render(<Diagnosis />)

    await user.click(screen.getByRole('button', { name: 'Copy report' }))

    expect(report.copy).toHaveBeenCalledTimes(1)
    expect(await screen.findByRole('status')).toHaveTextContent('Copied')
  })

  it('points to the download when copying fails', async () => {
    current = { ...report, copy: vi.fn(() => Promise.resolve('failed' as const)) }
    const user = userEvent.setup()
    render(<Diagnosis />)

    await user.click(screen.getByRole('button', { name: 'Copy report' }))

    expect(await screen.findByRole('status')).toHaveTextContent(
      /Use Download report instead/,
    )
  })

  it('clears the recording', async () => {
    const user = userEvent.setup()
    render(<Diagnosis />)

    await user.click(screen.getByRole('button', { name: 'Clear' }))

    expect(report.clear).toHaveBeenCalledTimes(1)
  })

  it('has no detectable accessibility violations', async () => {
    const { container } = render(<Diagnosis />)
    expect(await axe(container)).toHaveNoViolations()
  })
})
