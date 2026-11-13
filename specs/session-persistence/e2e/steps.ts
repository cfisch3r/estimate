import { writeFileSync } from 'node:fs'
import { expect } from '@playwright/test'
import {
  addItem,
  closeTabAndCheckLeaveWarning,
  continueSingleUser,
  expectActiveItem,
  expectAtModeSelection,
  expectFinalizedEstimate,
  expectItemList,
  expectLeaveConfirmationForUnsavedChanges,
  expectLoadRejected,
  expectNoSessionLoaded,
  expectSessionName,
  finalizeItem,
  joinSessionAsParticipant,
  leaveSession,
  loadSessionFile,
  saveSession,
  setSessionName,
  startCollaborativeEstimation,
  startSingleUserSession,
} from '../../../e2e/helpers'
import { DataTable } from 'playwright-bdd'
import { Given, When, Then, requireState } from './world'
import { aSessionFile, anEstimatedItem, anUnestimatedItem } from './stereotypes'
import type { FinalResultV1, ItemV1 } from './stereotypes'

type ThreePoint = { best: number; likely: number; worst: number }

/** Reads a `| item | best | likely | worst |` table into one estimate per row. */
function estimatesFrom(table: DataTable): { title: string; estimate: ThreePoint }[] {
  return table.hashes().map((row) => {
    const values = [row.best, row.likely, row.worst].map(Number)
    const [best, likely, worst] = values
    if (
      !row.item ||
      best === undefined ||
      likely === undefined ||
      worst === undefined ||
      values.some(Number.isNaN)
    ) {
      throw new Error(
        `Estimate rows need item, best, likely and worst: ${JSON.stringify(row)}`,
      )
    }
    return { title: row.item, estimate: { best, likely, worst } }
  })
}

/** Scenario wording for a final-result field → its name in the file. */
const finalResultField: Record<string, keyof FinalResultV1> = {
  minimum: 'min',
  expected: 'expected',
  maximum: 'max',
}

/** Writes `file` as JSON into the test's output folder and makes it the file
 *  the next load step picks. */
function useSessionFile(
  {
    state,
    filePath,
  }: { state: { sessionFile?: string }; filePath: (n: string) => string },
  name: string,
  file: unknown,
): void {
  const path = filePath(name)
  writeFileSync(path, JSON.stringify(file))
  state.sessionFile = path
}

// --- Given ----------------------------------------------------------------

Given(
  '{word} is estimating alone in a session named {string}',
  async ({ actor }, name: string, sessionName: string) => {
    const page = await actor(name)
    await startSingleUserSession(page)
    await setSessionName(page, sessionName)
  },
)

Given('{word} has added the items', async ({ actor }, name: string, table: DataTable) => {
  const page = await actor(name)
  for (const [title] of table.raw()) {
    if (!title) throw new Error('Each row of the item list needs a title')
    await addItem(page, title)
  }
})

Given('{word} has finalized', async ({ actor }, name: string, table: DataTable) => {
  const page = await actor(name)
  for (const { title, estimate } of estimatesFrom(table)) {
    await finalizeItem(page, title, estimate)
  }
})

Given(
  '{word} has a saved session file {string} with the items',
  async ({ state, filePath }, _name: string, sessionName: string, table: DataTable) => {
    const items: ItemV1[] = table.hashes().map((row) => {
      const title = row.item ?? ''
      if (row.state === 'estimated') return anEstimatedItem(title)
      if (row.state === 'not estimated') return anUnestimatedItem(title)
      throw new Error(`Unknown item state "${row.state}" — use estimated / not estimated`)
    })
    useSessionFile(
      { state, filePath },
      'resume-live.estimate.json',
      aSessionFile(items, { sessionName }),
    )
  },
)

Given(
  '{word} has a saved session file with the estimated item {string}, changed to',
  async ({ state, filePath }, _name: string, title: string, table: DataTable) => {
    const overrides: Partial<FinalResultV1> = {}
    for (const [label, value] of Object.entries(table.rowsHash())) {
      const field = finalResultField[label]
      if (!field) throw new Error(`Unknown final-result field "${label}"`)
      overrides[field] = Number(value)
    }
    useSessionFile(
      { state, filePath },
      'damaged.estimate.json',
      aSessionFile([anEstimatedItem(title, overrides)]),
    )
  },
)

// --- When -----------------------------------------------------------------

When('{word} saves the session', async ({ actor, state, filePath }, name: string) => {
  const path = filePath('saved.estimate.json')
  await saveSession(await actor(name), path)
  state.sessionFile = path
})

When('{word} leaves the session', async ({ actor }, name: string) => {
  await leaveSession(await actor(name))
})

When('{word} loads the saved file', async ({ actor, state }, name: string) => {
  await loadSessionFile(await actor(name), requireState(state, 'sessionFile'))
})

When('{word} continues alone', async ({ actor }, name: string) => {
  await continueSingleUser(await actor(name))
})

When('{word} starts a collaborative session', async ({ actor, state }, name: string) => {
  state.sessionCode = await startCollaborativeEstimation(await actor(name))
})

When('{word} joins the session', async ({ actor, state }, name: string) => {
  await joinSessionAsParticipant(
    await actor(name),
    requireState(state, 'sessionCode'),
    name,
  )
})

When('{word} closes the tab', async ({ actor, state }, name: string) => {
  state.leavePageWarning = await closeTabAndCheckLeaveWarning(await actor(name))
})

// --- Then -----------------------------------------------------------------

Then(
  '{word} sees the session named {string}',
  async ({ actor }, name: string, sessionName: string) => {
    await expectSessionName(await actor(name), sessionName)
  },
)

Then('{word} is estimating {string}', async ({ actor }, name: string, title: string) => {
  await expectActiveItem(await actor(name), title)
})

Then(
  '{word} sees the finalized estimates',
  async ({ actor }, name: string, table: DataTable) => {
    const page = await actor(name)
    for (const { title, estimate } of estimatesFrom(table)) {
      await expectFinalizedEstimate(page, title, estimate)
    }
  },
)

Then('{word} sees the items', async ({ actor }, name: string, table: DataTable) => {
  await expectItemList(
    await actor(name),
    table.raw().map(([title]) => title ?? ''),
  )
})

Then("{word} is told the file can't be loaded", async ({ actor }, name: string) => {
  await expectLoadRejected(await actor(name))
})

Then('{word} has no session loaded', async ({ actor }, name: string) => {
  await expectNoSessionLoaded(await actor(name))
})

Then(
  '{word} is asked to confirm leaving because of unsaved changes',
  async ({ actor }, name: string) => {
    await expectLeaveConfirmationForUnsavedChanges(await actor(name))
  },
)

Then('{word} is back at mode selection', async ({ actor }, name: string) => {
  await expectAtModeSelection(await actor(name))
})

Then(
  'the browser asks {word} to confirm leaving the page',
  async ({ state }, _name: string) => {
    expect(requireState(state, 'leavePageWarning')).toBe(true)
  },
)
