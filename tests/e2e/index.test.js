import { expect, test } from '@playwright/test';
import fs from 'fs/promises';

test('loaded Whats Organizer', async ({ page }) => {
  await page.goto('/');
  
  const title = page.locator('h1')
  const uploadForm = page.getByTestId('file-upload-form')
  const uploadInput = page.locator('[data-testid="playwright-inject-media"]')
  const submitBtn = page.getByTestId('submit-zip-btn')

  await expect(title).toBeVisible();
  await expect(uploadForm).toBeVisible();
  await expect(submitBtn).toBeVisible();
  
  const filePath = '/home/skid/My_Code/whats-organizer/tests/android-tom/teste-simples-symlink-deve-falhar.zip'
  const fileBuffer = await fs.readFile(filePath)

  await uploadInput.evaluate((input) => {
    input.setAttribute('style', 'display: block')
    input.removeAttribute('disabled')
  })
  

  await uploadInput.setInputFiles([
    {
      name: 'teste-simples-symlink-deve-falhar.zip',
      mimeType: 'application/zip',
      buffer: fileBuffer
    }
  ])

  await uploadInput.evaluate((input) => input.dispatchEvent(new Event('change', { bubbles: true })))

  await new Promise((resolve) => setTimeout(resolve, 30000))
  await submitBtn.evaluate((e) => {
    e.removeAttribute('class')
    e.removeAttribute('disabled')
  })
  await submitBtn.click();
  await new Promise((resolve) => setTimeout(resolve, 10000))
});
