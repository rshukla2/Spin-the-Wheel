import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.goto('./')
  await page.evaluate(() => localStorage.clear())
  await page.reload()
})

test('edits entries, spins, records the result, and restores state', async ({ page }) => {
  const editor = page.getByRole('textbox', { name: /wheel entries/i })
  await editor.fill('Tutorial\nStory\nHot take')
  await page.getByRole('button', { name: 'Spin the wheel' }).click()
  await expect(page.getByRole('dialog')).toBeVisible({ timeout: 7_000 })
  await page.getByRole('button', { name: 'Close result' }).click()
  await page.reload()
  await expect(editor).toHaveValue('Tutorial\nStory\nHot take')
  await page.getByRole('tab', { name: /Results \(1\)/ }).click()
  await expect(page.getByRole('tabpanel').getByText(/Tutorial|Story|Hot take/)).toBeVisible()
})

test('supports keyboard spinning', async ({ page }) => {
  await page.locator('body').press('Space')
  await expect(page.getByRole('dialog')).toBeVisible({ timeout: 7_000 })
})
