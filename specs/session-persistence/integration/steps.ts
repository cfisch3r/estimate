import { expect } from '@playwright/test'
import { Given, When, Then, requireState } from '../../shared/integration/world'

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
  expect(requireState(state, 'savedFile').content).toBe(text)
})
