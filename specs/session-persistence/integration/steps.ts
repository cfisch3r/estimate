import { expect } from '@playwright/test'
import type { DataTable } from 'playwright-bdd'
import type { LocalDate } from '../../../src/application/ports/outbound/sessionFiles'
import type { SavedSession } from '../../../src/domain/savedSession'
import { Given, When, Then, requireState } from '../../shared/integration/world'
import type { ScenarioState, Tab } from '../../shared/integration/world'

Given('a browser tab', async ({ tab }) => {
  await tab('Browser', 'one')
})

When(
  'the tab downloads {string} with the text {string}',
  async ({ tab, state }, fileName: string, text: string) => {
    const { files } = await tab('Browser', 'one')
    state.savedFile = await files.download(fileName, text, 'application/json')
  },
)

Then('the browser saves a file named {string}', async ({ state }, fileName: string) => {
  expect(requireState(state, 'savedFile').suggestedName).toBe(fileName)
})

Then('the saved file contains exactly {string}', async ({ state }, text: string) => {
  // Bytes, not decoded text: a change of encoding must not pass unnoticed.
  expect(requireState(state, 'savedFile').bytes).toEqual(Buffer.from(text, 'utf8'))
})

// --- Session files ----------------------------------------------------------

/** A consistent final result: the values estimation-method's final-result
 *  feature accepts. */
const FINAL_RESULT = { min: 3, expected: 5.8, max: 12, ci90: 9.64 }

/** The date a save happens on when the scenario doesn't name one. */
const SOME_DAY: LocalDate = { year: 2026, month: 11, day: 23 }

/** A saved session the scenario knows to keep every rule. Built as plain
 *  data, because integration steps take only types from src/ (ADR-011); the
 *  brand is compile-time only, and the adapter checks what it reads anyway. */
function savedSessionFixture(
  sessionName: string,
  unit: string,
  rows: Record<string, string>[],
): SavedSession {
  return {
    sessionName,
    unit,
    items: rows.map((row, index) => ({
      id: `item-${index + 1}`,
      title: row.item ?? '',
      description: row.description ?? '',
      notes: row.notes ?? '',
      finalResult: row.state === 'estimated' ? { ...FINAL_RESULT } : null,
    })),
  } as unknown as SavedSession
}

function dateOf(text: string): LocalDate {
  const [year, month, day] = text.split('-').map(Number)
  if (year === undefined || month === undefined || day === undefined) {
    throw new Error(`Not a date like 2026-11-12: ${text}`)
  }
  return { year, month, day }
}

/** A version-1 session file's text, with `change` applied to its plain JSON. */
function sessionFileText(change: (file: SessionFileJson) => void = () => {}): string {
  const file: SessionFileJson = {
    version: 1,
    sessionName: 'Checkout rework',
    unit: 'days',
    items: [
      {
        id: 'a',
        title: 'Login',
        description: '',
        notes: '',
        finalResult: { ...FINAL_RESULT },
      },
      { id: 'b', title: 'Search', description: '', notes: '', finalResult: null },
    ],
  }
  change(file)
  return JSON.stringify(file)
}

type SessionFileJson = {
  version: number
  sessionName: string
  unit: string
  items: {
    id: string
    title: string
    description: string
    notes: string
    finalResult: unknown
  }[]
}

async function openText(
  tab: (browser: string, tab: string) => Promise<Tab>,
  state: ScenarioState,
  text: string,
): Promise<void> {
  const { sessionFiles } = await tab('Browser', 'one')
  state.openedText = text
  state.opened = await sessionFiles.open({
    name: 'picked.estimate.json',
    bytes: Buffer.from(text, 'utf8'),
  })
}

function openedSession(state: ScenarioState): SavedSession {
  const opened = requireState(state, 'opened')
  if (!opened.ok)
    throw new Error(`The file was rejected: ${JSON.stringify(opened.error)}`)
  return opened.value
}

Given(
  'a saved session named {string} estimated in {word} with the items',
  async ({ state }, sessionName: string, unit: string, table: DataTable) => {
    state.savedSession = savedSessionFixture(sessionName, unit, table.hashes())
  },
)

Given('a saved session named {string}', async ({ state }, sessionName: string) => {
  state.savedSession = savedSessionFixture(sessionName, 'days', [])
})

When('the tab saves it', async ({ tab, state }) => {
  const { sessionFiles } = await tab('Browser', 'one')
  state.sessionFileSave = await sessionFiles.save(
    requireState(state, 'savedSession'),
    SOME_DAY,
  )
})

When('the tab saves it on {word}', async ({ tab, state }, date: string) => {
  const { sessionFiles } = await tab('Browser', 'one')
  state.sessionFileSave = await sessionFiles.save(
    requireState(state, 'savedSession'),
    dateOf(date),
  )
})

Then('the browser saves the file as {string}', async ({ state }, fileName: string) => {
  const saved = requireState(state, 'sessionFileSave')
  expect(saved.fileName).toBe(fileName)
  expect(saved.savedFile.suggestedName).toBe(fileName)
})

When('the user opens the file the browser saved', async ({ tab, state }) => {
  const { sessionFiles } = await tab('Browser', 'one')
  const { savedFile } = requireState(state, 'sessionFileSave')
  state.opened = await sessionFiles.open({
    name: savedFile.suggestedName,
    bytes: savedFile.bytes,
  })
})

Then('the tab opens the same session', async ({ state }) => {
  expect(openedSession(state)).toEqual(requireState(state, 'savedSession'))
})

When('the user opens a file containing', async ({ tab, state }, text: string) => {
  await openText(tab, state, text)
})

When(
  'the user opens a file containing {string}',
  async ({ tab, state }, text: string) => {
    await openText(tab, state, text)
  },
)

When(
  'the user opens a session file of version {int}',
  async ({ tab, state }, version: number) => {
    await openText(
      tab,
      state,
      sessionFileText((file) => {
        file.version = version
      }),
    )
  },
)

When(
  'the user opens a session file whose item {int} has the same id as item {int}',
  async ({ tab, state }, position: number, samePositionAs: number) => {
    await openText(
      tab,
      state,
      sessionFileText((file) => {
        const item = file.items[position - 1]
        const same = file.items[samePositionAs - 1]
        if (!item || !same) throw new Error('The file has only two items')
        item.id = same.id
      }),
    )
  },
)

Then(
  'the tab opens a session named {string} estimated in {word} with the items',
  async ({ state }, sessionName: string, unit: string, table: DataTable) => {
    const session = openedSession(state)
    expect(session.sessionName).toBe(sessionName)
    expect(session.unit).toBe(unit)
    const source = JSON.parse(requireState(state, 'openedText')) as SessionFileJson
    const rows = table.hashes()
    expect(session.items.map((item) => item.title)).toEqual(rows.map((row) => row.item))
    rows.forEach((row, index) => {
      const item = session.items[index]
      expect(item).toMatchObject({ description: row.description, notes: row.notes })
      if (row.state === 'estimated') {
        expect(item?.finalResult).toEqual(source.items[index]?.finalResult)
      } else if (row.state === 'not estimated') {
        expect(item?.finalResult).toBeNull()
      } else {
        throw new Error(
          `Unknown item state "${row.state}" — use estimated / not estimated`,
        )
      }
    })
  },
)

Given('the user picked a file that was deleted afterwards', async ({ state }) => {
  state.pick = { deletedAfterPicking: true }
})

When('the tab opens it', async ({ tab, state }) => {
  const { sessionFiles } = await tab('Browser', 'one')
  state.opened = await sessionFiles.open(requireState(state, 'pick'))
})

Then('it is rejected as saved by a newer version of EstiMate', async ({ state }) => {
  expect(requireState(state, 'opened')).toEqual({
    ok: false,
    error: { code: 'newer-version' },
  })
})

Then('it is rejected as not a session file', async ({ state }) => {
  expect(requireState(state, 'opened')).toEqual({
    ok: false,
    error: { code: 'not-a-session-file' },
  })
})

Then('it is rejected as unreadable', async ({ state }) => {
  expect(requireState(state, 'opened')).toEqual({
    ok: false,
    error: { code: 'unreadable' },
  })
})

Then(
  'it is rejected because item {int} has the same id as item {int}',
  async ({ state }, position: number, samePositionAs: number) => {
    expect(requireState(state, 'opened')).toEqual({
      ok: false,
      error: { code: 'duplicate-item-id', position, samePositionAs },
    })
  },
)
