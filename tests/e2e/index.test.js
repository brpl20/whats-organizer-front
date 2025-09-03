import { expect, test } from '@playwright/test';

test('loaded Whats Organizer', async ({ page }) => {
	await page.goto('/');
	await expect(page.locator('h1')).toBeVisible();
	await expect(page.getByTestId('file-upload-form')).toBeVisible();
});
