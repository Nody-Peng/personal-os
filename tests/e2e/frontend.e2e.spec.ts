import { expect, test } from '@playwright/test'

test.describe('Frontend', () => {
  test('sends visitors who are not logged in to the login page', async ({ page }) => {
    await page.goto('http://localhost:3000/toefl')
    await expect(page).toHaveURL(/\/login\?redirect=%2Ftoefl/)
  })
})
