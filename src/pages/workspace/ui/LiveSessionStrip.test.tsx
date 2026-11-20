import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { LiveConnectionStatus } from '../../../domain/types'
import { LiveSessionStrip } from './LiveSessionStrip'

function renderStrip(connectionStatus: LiveConnectionStatus, hasEverConnected = false) {
  render(
    <LiveSessionStrip
      sessionId="K7F9Q2"
      connectionStatus={connectionStatus}
      peerCount={0}
      hasEverConnected={hasEverConnected}
      onReconnect={vi.fn()}
    />,
  )
}

describe('LiveSessionStrip', () => {
  it('links a disconnected session to the connection diagnosis', () => {
    renderStrip('disconnected')

    expect(screen.getByText('Disconnected')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Show diagnosis/ })).toBeInTheDocument()
  })

  it('reads the status before the actions that fix it, Reconnect first', () => {
    renderStrip('disconnected')

    const status = screen.getByText('Disconnected')
    const reconnect = screen.getByRole('button', { name: 'Reconnect' })
    const diagnosis = screen.getByRole('link', { name: /Show diagnosis/ })
    const follows = (a: Element, b: Element) =>
      Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING)
    expect(follows(status, reconnect)).toBe(true)
    expect(follows(reconnect, diagnosis)).toBe(true)
  })

  it.each([
    ['waiting for participants', 'connecting' as const, false],
    ['after everyone left', 'connecting' as const, true],
    ['while connected', 'connected' as const, true],
  ])('shows no diagnosis link %s', (_name, status, hasEverConnected) => {
    renderStrip(status, hasEverConnected)
    expect(screen.queryByRole('link', { name: /Show diagnosis/ })).not.toBeInTheDocument()
  })
})
