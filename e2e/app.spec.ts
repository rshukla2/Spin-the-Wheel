import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.goto('./')
  await page.evaluate(() => localStorage.clear())
  await page.reload()
})

test('edits entries, spins, records the result, and restores state', async ({ page }) => {
  const editor = page.getByRole('textbox', { name: /wheel entries/i })
  await editor.fill('Quality Assurance Engineer\nStory\nHot take')
  await expect(page.getByRole('img')).toContainText('Quality Assurance Engineer')
  await page.getByRole('button', { name: 'Spin the wheel' }).click()
  await expect(page.locator('[data-winner="true"]')).toBeVisible({ timeout: 7_000 })
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect.poll(() => page.evaluate(() => {
    const stored = localStorage.getItem('spin-the-wheel.workspace.v1')
    if (!stored) return 0
    return JSON.parse(stored).wheels[0]?.results?.length ?? 0
  })).toBe(1)
  await page.reload()
  await expect(editor).toHaveValue('Quality Assurance Engineer\nStory\nHot take')
  await page.getByRole('tab', { name: /Results \(1\)/ }).click()
  await expect(page.getByRole('tabpanel').getByText(/Quality Assurance Engineer|Story|Hot take/)).toBeVisible()
})

test('supports keyboard spinning', async ({ page }) => {
  await page.locator('body').press('Space')
  await expect(page.locator('[data-winner="true"]')).toBeVisible({ timeout: 7_000 })
})

test('keeps dense labels readable and the selected label clear of the pointer', async ({ page }) => {
  const entries = ['Quality Assurance Engineer', ...Array.from({ length: 49 }, (_, index) => `Role ${index + 2}`)]
  await page.getByRole('textbox', { name: /wheel entries/i }).fill(entries.join('\n'))

  const labels = page.locator('.wheel-label')
  await expect(labels).toHaveCount(50)
  const fontSizes = await labels.evaluateAll((nodes) => nodes.map((node) => Number.parseFloat(getComputedStyle(node).fontSize)))
  expect(Math.min(...fontSizes)).toBeGreaterThanOrEqual(12)

  await page.getByRole('button', { name: 'Spin the wheel' }).click()
  const winningLabel = page.locator('[data-winner="true"] .wheel-label')
  await expect(winningLabel).toBeVisible({ timeout: 7_000 })
  const [pointerBox, labelBox] = await Promise.all([
    page.locator('.wheel-pointer').boundingBox(),
    winningLabel.boundingBox(),
  ])
  expect(pointerBox).not.toBeNull()
  expect(labelBox).not.toBeNull()
  expect(labelBox!.y).toBeGreaterThan(pointerBox!.y + pointerBox!.height)
})
