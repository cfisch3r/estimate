import type { SessionRole } from '../types'
import type { CandidateKind, DiagnosticEntry } from './types'
import { mergeByTime } from './log'

/** Browser name with major version, and operating system, read from a user
 *  agent string. Order matters: Edge also names Chrome, Chrome also names
 *  Safari, and iOS also says "like Mac OS X". */
export function describeUserAgent(userAgent: string): { browser: string; os: string } {
  return { browser: browserOf(userAgent), os: osOf(userAgent) }
}

const BROWSERS: ReadonlyArray<[name: string, version: RegExp]> = [
  ['Edge', /Edg\/(\d+)/],
  ['Firefox', /Firefox\/(\d+)/],
  ['Chrome', /Chrome\/(\d+)/],
  ['Safari', /Version\/(\d+).*Safari\//],
]

function browserOf(userAgent: string): string {
  for (const [name, version] of BROWSERS) {
    const match = version.exec(userAgent)
    if (match) return `${name} ${match[1]}`
  }
  return 'Unknown browser'
}

const SYSTEMS: ReadonlyArray<[name: string, marker: RegExp]> = [
  ['Windows', /Windows NT/],
  ['iOS', /iPhone|iPad/],
  ['Android', /Android/],
  ['macOS', /Mac OS X/],
  ['Linux', /Linux/],
]

function osOf(userAgent: string): string {
  return SYSTEMS.find(([, marker]) => marker.test(userAgent))?.[0] ?? 'Unknown OS'
}

const kindText = ({ type, protocol }: CandidateKind) => `${type}/${protocol}`

/** One entry's text, without its time and tab. */
function describe(entry: DiagnosticEntry): string {
  switch (entry.kind) {
    case 'session-start':
      return `session start  code ${entry.sessionCode}  role ${entry.role}`
    case 'status':
      return `status  ${entry.status}`
    case 'peer-join':
      return `peer joined  ${entry.peer}`
    case 'peer-leave':
      return `peer left  ${entry.peer}`
    case 'join-error':
      return `join error  ${entry.error}${entry.peer ? `  peer ${entry.peer}` : ''}`
    case 'rtc-candidates': {
      const kinds = entry.candidates.map(kindText).join(', ') || 'none'
      return `attempt ${entry.attempt}  ${entry.side} candidates  ${kinds}`
    }
    case 'rtc-state':
      return `attempt ${entry.attempt}  connection ${entry.connectionState}  ice ${entry.iceConnectionState}`
    case 'rtc-selected':
      return `attempt ${entry.attempt}  selected pair  ${kindText(entry.local)} to ${kindText(entry.remote)}`
  }
}

/** The plain-text report a tester downloads: what was used, then one line per
 *  entry, every tab merged in time order and labelled with its tab and, from
 *  the tab's first session start on, the role of its latest one. Holds only what the entries hold: no names, values or
 *  addresses. */
export function formatDiagnosisReport(input: {
  entries: DiagnosticEntry[]
  userAgent: string
  appVersion: string
  generatedAt: string
}): string {
  const { browser, os } = describeUserAgent(input.userAgent)
  const header = [
    'EstiMate connection diagnosis',
    `Generated: ${input.generatedAt}`,
    `App version: ${input.appVersion}`,
    `Browser: ${browser} on ${os}`,
    '',
  ]
  const roles = new Map<string, SessionRole>()
  const lines = mergeByTime({ all: input.entries }).map((entry) => {
    if (entry.kind === 'session-start') roles.set(entry.tab, entry.role)
    const role = roles.get(entry.tab)
    const label = role ? `${entry.tab} ${role}` : entry.tab
    return `${entry.at} [${label}] ${describe(entry)}`
  })
  return [
    ...header,
    ...(lines.length > 0 ? lines : ['No connection events recorded.']),
  ].join('\n')
}

/** A local date and time, to the minute. */
export type LocalDateTime = {
  year: number
  month: number
  day: number
  hour: number
  minute: number
}

const pad = (value: number) => String(value).padStart(2, '0')

/** The report's file name, after when it was downloaded:
 *  `estimate-diagnosis-2026-03-07-0905.txt`. */
export function diagnosisFileName(at: LocalDateTime): string {
  return `estimate-diagnosis-${at.year}-${pad(at.month)}-${pad(at.day)}-${pad(at.hour)}${pad(at.minute)}.txt`
}
