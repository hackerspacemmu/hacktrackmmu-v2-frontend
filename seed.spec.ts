import { test, expect } from '@playwright/test';

test.describe('Test group', () => {
  test('seed', async ({ page }) => {
    await page.goto('http://localhost:8000/login');
    // generate code here.
  });
});
