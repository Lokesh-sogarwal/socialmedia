import { expect, test } from '@playwright/test';
import { API, apiRegister, pngFile, uiLogin } from './helpers.js';

test('layout adapts without horizontal scrolling', async ({ page, request }, testInfo) => {
  const user = await apiRegister(request, 'resp', { displayName: 'Rae Responsive' });
  await request.post(`${API}/posts`, { headers: user.headers, multipart: { caption: 'Responsive check #layout', media: await pngFile() } });
  await uiLogin(page, user);

  const width = page.viewportSize().width;
  const mainNav = page.getByRole('navigation', { name: 'Main' });
  if (width < 768) {
    await expect(page.getByRole('button', { name: 'Create post' })).toBeVisible(); // bottom bar
    await expect(page.locator('aside').first()).toBeHidden();
  } else {
    await expect(mainNav.first()).toBeVisible();
  }

  for (const path of ['/', '/explore', '/messages', `/u/${user.username}`, '/settings', '/notifications']) {
    await page.goto(path);
    await page.waitForLoadState('networkidle');
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, `horizontal overflow on ${path}`).toBeLessThanOrEqual(0);
  }
  await page.goto('/');
  await expect(page.getByText('Responsive check')).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath(`home-${testInfo.project.name}.png`), fullPage: false });
});
