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

  it.each([
    ['waiting for participants', 'connecting' as const, false],
    ['after everyone left', 'connecting' as const, true],
    ['while connected', 'connected' as const, true],
  ])('shows no diagnosis link %s', (_name, status, hasEverConnected) => {
    renderStrip(status, hasEverConnected)
    expect(screen.queryByRole('link', { name: /Show diagnosis/ })).not.toBeInTheDocument()
  })
})
