import { describe, expect, it } from 'vitest'
import { describeUserAgent, diagnosisFileName, formatDiagnosisReport } from './report'
import type { DiagnosticEntry } from './types'

const CHROME_MAC =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
const SAFARI_MAC =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Safari/605.1.15'
const FIREFOX_WINDOWS =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:133.0) Gecko/20100101 Firefox/133.0'
const EDGE_WINDOWS =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.2903.70'
const SAFARI_IPAD =
  'Mozilla/5.0 (iPad; CPU OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1'
const CHROME_ANDROID =
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36'
const FIREFOX_LINUX =
  'Mozilla/5.0 (X11; Linux x86_64; rv:133.0) Gecko/20100101 Firefox/133.0'

describe('describeUserAgent', () => {
  it.each([
    [CHROME_MAC, 'Chrome 131', 'macOS'],
    [SAFARI_MAC, 'Safari 18', 'macOS'],
    [FIREFOX_WINDOWS, 'Firefox 133', 'Windows'],
    [EDGE_WINDOWS, 'Edge 131', 'Windows'],
    [SAFARI_IPAD, 'Safari 18', 'iOS'],
    [CHROME_ANDROID, 'Chrome 131', 'Android'],
    [FIREFOX_LINUX, 'Firefox 133', 'Linux'],
  ])('reads %s', (ua, browser, os) => {
    expect(describeUserAgent(ua)).toEqual({ browser, os })
  })

  it('says unknown for a user agent it does not recognise', () => {
    expect(describeUserAgent('curl/8.0')).toEqual({
      browser: 'Unknown browser',
      os: 'Unknown OS',
    })
  })
})

const at = (second: number) => `2026-11-20T10:00:${String(second).padStart(2, '0')}.000Z`

describe('formatDiagnosisReport', () => {
  const header = {
    userAgent: CHROME_MAC,
    appVersion: '0.9.0',
    generatedAt: '2026-11-20T10:05:00.000Z',
  }

  const entries: DiagnosticEntry[] = [
    { kind: 'status', status: 'connected', at: at(3), tab: 'f1' },
    {
      kind: 'session-start',
      sessionCode: 'QX7K2M',
      role: 'participant',
      at: at(0),
      tab: 'p1',
    },
    { kind: 'status', status: 'connecting', at: at(1), tab: 'p1' },
    { kind: 'peer-join', peer: 'abcdef', at: at(2), tab: 'p1' },
    {
      kind: 'join-error',
      error: 'incorrect password (abcdef)',
      peer: 'abcdef',
      at: at(4),
      tab: 'p1',
    },
    { kind: 'join-error', error: 'handshake timed out', at: at(5), tab: 'p1' },
    {
      kind: 'rtc-candidates',
      attempt: 1,
      side: 'local',
      candidates: [
        { type: 'host', protocol: 'udp' },
        { type: 'host', protocol: 'tcp' },
      ],
      at: at(6),
      tab: 'p1',
    },
    {
      kind: 'rtc-candidates',
      attempt: 1,
      side: 'remote',
      candidates: [],
      at: at(7),
      tab: 'p1',
    },
    {
      kind: 'rtc-state',
      attempt: 1,
      connectionState: 'connected',
      iceConnectionState: 'connected',
      at: at(8),
      tab: 'p1',
    },
    {
      kind: 'rtc-selected',
      attempt: 1,
      local: { type: 'host', protocol: 'udp' },
      remote: { type: 'srflx', protocol: 'udp' },
      at: at(9),
      tab: 'p1',
    },
    { kind: 'peer-leave', peer: 'abcdef', at: at(10), tab: 'p1' },
    { kind: 'status', status: 'idle', at: at(11), tab: 'p1' },
  ]

  it('starts with what was used, then one line per entry in time order', () => {
    const lines = formatDiagnosisReport({ ...header, entries }).split('\n')
    expect(lines.slice(0, 5)).toEqual([
      'EstiMate connection diagnosis',
      'Generated: 2026-11-20T10:05:00.000Z',
      'App version: 0.9.0',
      'Browser: Chrome 131 on macOS',
      '',
    ])
    expect(lines.slice(5)).toEqual([
      '2026-11-20T10:00:00.000Z [p1 participant] session start  code QX7K2M  role participant',
      '2026-11-20T10:00:01.000Z [p1 participant] status  connecting',
      '2026-11-20T10:00:02.000Z [p1 participant] peer joined  abcdef',
      '2026-11-20T10:00:03.000Z [f1] status  connected',
      '2026-11-20T10:00:04.000Z [p1 participant] join error  incorrect password (abcdef)  peer abcdef',
      '2026-11-20T10:00:05.000Z [p1 participant] join error  handshake timed out',
      '2026-11-20T10:00:06.000Z [p1 participant] attempt 1  local candidates  host/udp, host/tcp',
      '2026-11-20T10:00:07.000Z [p1 participant] attempt 1  remote candidates  none',
      '2026-11-20T10:00:08.000Z [p1 participant] attempt 1  connection connected  ice connected',
      '2026-11-20T10:00:09.000Z [p1 participant] attempt 1  selected pair  host/udp to srflx/udp',
      '2026-11-20T10:00:10.000Z [p1 participant] peer left  abcdef',
      '2026-11-20T10:00:11.000Z [p1 participant] status  idle',
    ])
  })

  it("labels each tab's lines with the role of its latest session start", () => {
    const lines = formatDiagnosisReport({
      ...header,
      entries: [
        { kind: 'status', status: 'connecting', at: at(0), tab: 't1' },
        {
          kind: 'session-start',
          sessionCode: 'AAAAAA',
          role: 'facilitator',
          at: at(1),
          tab: 't1',
        },
        { kind: 'status', status: 'connected', at: at(2), tab: 't1' },
        { kind: 'status', status: 'connected', at: at(3), tab: 't2' },
        {
          kind: 'session-start',
          sessionCode: 'BBBBBB',
          role: 'participant',
          at: at(4),
          tab: 't1',
        },
        { kind: 'status', status: 'connecting', at: at(5), tab: 't1' },
      ],
    })
      .split('\n')
      .slice(5)
      .map((line) => line.slice(25, line.indexOf(']') + 1))
    expect(lines).toEqual([
      '[t1]',
      '[t1 facilitator]',
      '[t1 facilitator]',
      '[t2]',
      '[t1 participant]',
      '[t1 participant]',
    ])
  })

  it('says so when nothing was recorded', () => {
    expect(
      formatDiagnosisReport({ ...header, entries: [] })
        .split('\n')
        .slice(4),
    ).toEqual(['', 'No connection events recorded.'])
  })
})

describe('diagnosisFileName', () => {
  it('names the report after the local date and time, padded', () => {
    expect(diagnosisFileName({ year: 2026, month: 3, day: 7, hour: 9, minute: 5 })).toBe(
      'estimate-diagnosis-2026-03-07-0905.txt',
    )
  })
})
