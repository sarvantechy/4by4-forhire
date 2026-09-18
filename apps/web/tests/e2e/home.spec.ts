import { expect, test } from '@playwright/test';

const viewports = [
  { name: 'mobile', width: 360, height: 800 },
  { name: 'desktop', width: 1280, height: 900 },
];

for (const viewport of viewports) {
  test(`home shell is usable at ${viewport.name} width`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto('/');

    await expect(page.getByRole('heading', { name: 'What do you need today?' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Popular categories' })).toBeVisible();
    await expect(page.getByText('No active listings yet')).toBeVisible();
    await expect(page.getByRole('link', { name: 'List an item' }).first()).toBeVisible();

    const horizontalOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(horizontalOverflow).toBe(false);

    const backgroundImage = await page.locator('.category-tile').first().evaluate(
      (element) => getComputedStyle(element).backgroundImage,
    );
    expect(backgroundImage).not.toBe('none');

    await page.screenshot({
      fullPage: true,
      path: `test-results/home-${viewport.name}.png`,
    });
  });
}
