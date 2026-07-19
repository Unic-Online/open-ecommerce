import { expect, test } from '@playwright/test';
import { clearCartStorage } from './fixtures/cart';
import { deleteReviewsByName } from './fixtures/db';

// Reviews run on the RO storefront so the form copy is Romanian.
const PRODUCT = '/ro/mobilier/oslo-nightstand';

test.describe('User-submitted reviews — submission is moderated, never immediate', () => {
  test.beforeEach(async ({ page }) => {
    await clearCartStorage(page);
  });

  test('the "Adaugă recenzia ta" button is visible on the product page', async ({ page }) => {
    await page.goto(PRODUCT);
    // ReviewSummary surfaces the canonical "Adaugă recenzia ta" CTA
    await expect(
      page.getByRole('button', { name: 'Adaugă recenzia ta' }),
    ).toBeVisible();
  });

  test('valid submission shows the moderation-pending message, not the review itself', async ({ page }) => {
    const name = `E2E Pending ${Date.now()}`;
    await page.goto(PRODUCT);

    await page.getByRole('button', { name: 'Adaugă recenzia ta' }).click();

    await page.getByLabel(/numele tău/i).fill(name);
    await page.getByRole('radio', { name: /4 stele/i }).click();
    await page.getByLabel(/^titlu/i).fill('Foarte bună noptiera');
    await page
      .getByLabel(/^comentariu$/i)
      .fill('Test recenzie automata, conținut suficient pentru validare.');
    await page.getByLabel(/email \(opțional\)/i).fill('reviewer@test.example');

    await page.getByRole('button', { name: /trimite recenzia/i }).click();

    // The new flow never shows the submitted review inline — it's pending
    // moderation. Only the "thanks, we'll review it" message appears.
    await expect(page.getByText(/va apărea pe site după verificare/i)).toBeVisible();
    await expect(page.getByText('Foarte bună noptiera')).toHaveCount(0);

    await deleteReviewsByName('oslo-nightstand', name);
  });

  test('submission with name too short shows an inline error', async ({ page }) => {
    await page.goto(PRODUCT);
    await page.getByRole('button', { name: 'Adaugă recenzia ta' }).click();

    await page.getByLabel(/numele tău/i).fill('A');
    await page
      .getByLabel(/^comentariu$/i)
      .fill('Recenzia mea de proba pentru validare.');
    await page.getByRole('button', { name: /trimite recenzia/i }).click();

    await expect(page.getByText(/introduci numele/i)).toBeVisible();
  });

  test('submission with too-short comment shows an inline error', async ({ page }) => {
    await page.goto(PRODUCT);
    await page.getByRole('button', { name: 'Adaugă recenzia ta' }).click();

    await page.getByLabel(/numele tău/i).fill('Tester');
    await page.getByLabel(/^comentariu$/i).fill('scurt');
    await page.getByRole('button', { name: /trimite recenzia/i }).click();

    await expect(page.getByText(/cel puțin 10 caractere/i)).toBeVisible();
  });
});
