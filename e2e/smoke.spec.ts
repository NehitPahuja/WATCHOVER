import { test, expect } from '@playwright/test'

test('homepage loads with WatchOver title', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveTitle(/WatchOver/)
})
