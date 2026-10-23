import { expect, test } from '@playwright/test';
import { API, apiRegister, pngFile, uiLogin, uniqueName } from './helpers.js';

test.describe.configure({ mode: 'serial' });

test('register, edit profile, post with media, and log out', async ({ page }) => {
  const username = uniqueName('alice');
  await page.goto('/');
  await expect(page).toHaveURL(/\/login$/);
  await page.getByRole('link', { name: 'Create an account' }).click();

  // Client-side validation
  await page.getByRole('button', { name: 'Sign up' }).click();
  await expect(page.getByText('Enter your name')).toBeVisible();

  await page.getByLabel('Name', { exact: true }).fill('Alice Rose');
  await page.getByLabel('Username').fill(username);
  await page.getByLabel('Email', { exact: true }).fill(`${username}@example.com`);
  await page.getByLabel('Password', { exact: true }).fill('passw0rd!');
  await page.getByLabel('Confirm password').fill('passw0rd!');
  await page.getByRole('button', { name: 'Sign up' }).click();
  await expect(page.getByRole('heading', { name: 'Home' })).toBeVisible();
  await expect(page.getByText('Your feed is waiting')).toBeVisible();

  // Edit profile
  await page.goto('/settings/profile');
  await page.getByLabel('Bio').fill('Coffee, film photos and #sunsets');
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByText('Profile saved')).toBeVisible();
  await page.getByLabel('Upload photo').setInputFiles(await pngFile('#4A4A4A'));
  await expect(page.getByText('Photo updated')).toBeVisible();

  // Create a post with an image
  await page.goto('/');
  await page.getByRole('button', { name: /What’s on your mind/ }).click();
  const dialog = page.getByRole('dialog', { name: 'Create post' });
  await dialog.getByLabel('Caption').fill('First light over the bay #sunsets');
  await dialog.getByLabel('Add photos or video').setInputFiles(await pngFile());
  await expect(dialog.getByAltText('Selected 1')).toBeVisible();
  await dialog.getByRole('button', { name: 'Share' }).click();
  await expect(page.getByText('Your post is live')).toBeVisible();
  const card = page.getByRole('article', { name: 'Post by Alice Rose' });
  await expect(card.getByText('First light over the bay')).toBeVisible();
  await expect(card.locator('img[src*="/uploads/posts/"]')).toBeVisible();

  // Profile reflects the post and bio
  await page.goto(`/u/${username}`);
  await expect(page.getByText('Coffee, film photos and')).toBeVisible();
  await expect(page.getByText(/^1$/).first()).toBeVisible();

  // Log out → protected pages redirect to login
  await page.goto('/settings');
  await page.getByRole('button', { name: 'Account menu' }).click();
  await page.getByRole('menuitem', { name: 'Log out' }).click();
  await expect(page).toHaveURL(/\/login$/);
  for (const path of ['/', '/messages', '/notifications', '/settings', `/u/${username}`]) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/login$/);
  }
});

test('follow, like, comment, bookmark, search, notifications and real-time messages', async ({ browser, request }) => {
  const alice = await apiRegister(request, 'alice', { displayName: 'Alice Rose' });
  const bob = await apiRegister(request, 'bob', { displayName: 'Bob Gray' });
  const post = await request.post(`${API}/posts`, { headers: alice.headers, multipart: { caption: 'Picnic day #weekend', media: await pngFile() } });
  expect(post.ok()).toBeTruthy();

  const aliceCtx = await browser.newContext();
  const bobCtx = await browser.newContext();
  const a = await aliceCtx.newPage();
  const b = await bobCtx.newPage();
  await uiLogin(a, alice);
  await uiLogin(b, bob);

  // Bob searches for Alice and follows her
  await b.goto('/search');
  await b.getByRole('searchbox', { name: 'Search' }).fill(alice.username.slice(0, 6));
  await b.locator('#main').getByRole('link', { name: new RegExp(`Alice Rose @${alice.username}`) }).click();
  await b.locator('#main').getByRole('button', { name: `Follow @${alice.username}` }).click();
  await expect(b.locator('#main').getByRole('button', { name: `Following @${alice.username}` })).toBeVisible();

  // Feed shows Alice's post; like, bookmark and comment
  await b.goto('/');
  const card = b.getByRole('article', { name: 'Post by Alice Rose' });
  await expect(card.getByText('Picnic day')).toBeVisible();
  await card.getByRole('button', { name: 'Like', exact: true }).click();
  await expect(card.getByRole('button', { name: '1 like' })).toBeVisible();
  await card.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(b.getByText('Saved to your collection')).toBeVisible();
  await card.getByRole('link', { name: 'Add a comment…' }).click();
  await b.getByLabel('Add a comment').fill('Looks lovely! @' + alice.username);
  await b.getByRole('button', { name: 'Post', exact: true }).click();
  await expect(b.getByText('Looks lovely!')).toBeVisible();

  await b.goto('/saved');
  await expect(b.getByRole('link', { name: /Open post: Picnic day/ })).toBeVisible();

  // Alice receives notifications (badge updates in real time)
  await a.goto('/notifications');
  await expect(a.getByText('started following you')).toBeVisible();
  await expect(a.getByText('liked your post')).toBeVisible();
  await expect(a.getByText('commented on your post')).toBeVisible();

  // Real-time messaging
  await b.goto(`/u/${alice.username}`);
  await b.locator('#main').getByRole('button', { name: 'Message' }).click();
  await expect(b).toHaveURL(/\/messages\/[a-f0-9]{24}$/);
  const convoUrl = b.url();
  await a.goto('/messages');
  await b.getByLabel('Message', { exact: true }).fill('Hey Alice! 👋');
  await b.keyboard.press('Enter');
  await expect(b.getByText('Hey Alice! 👋', { exact: true })).toBeVisible();
  // Alice sees it arrive without reloading
  await expect(a.getByRole('link', { name: /Bob Gray/ })).toBeVisible();
  await a.getByRole('link', { name: /Bob Gray/ }).click();
  await expect(a.getByText('Hey Alice! 👋', { exact: true })).toBeVisible();
  // Typing indicator + reply
  await a.getByLabel('Message', { exact: true }).pressSequentially('Hi Bob', { delay: 30 });
  await expect(b.getByText('typing…')).toBeVisible();
  await a.keyboard.press('Enter');
  await expect(b.getByText('Hi Bob', { exact: true })).toBeVisible();
  // Read receipt for Bob's message once Alice opened the thread
  await b.goto(convoUrl);
  await expect(b.getByText('Seen').first()).toBeVisible();

  await aliceCtx.close();
  await bobCtx.close();
});

test('private accounts and blocking are enforced', async ({ page, request }) => {
  const carol = await apiRegister(request, 'carol', { displayName: 'Carol Private', isPrivate: true });
  const dave = await apiRegister(request, 'dave', { displayName: 'Dave' });
  await request.post(`${API}/posts`, { headers: carol.headers, multipart: { caption: 'Only for friends' } });

  await uiLogin(page, dave);
  await page.goto(`/u/${carol.username}`);
  await expect(page.getByText('This account is private')).toBeVisible();
  await expect(page.getByText('Only for friends')).toHaveCount(0);
  await page.locator('#main').getByRole('button', { name: `Follow @${carol.username}` }).click();
  await expect(page.locator('#main').getByRole('button', { name: `Requested @${carol.username}` })).toBeVisible();

  // Carol approves via API; Dave can now see the post
  const carolUser = await (await request.get(`${API}/auth/me`, { headers: carol.headers })).json();
  expect(carolUser.data.user.isPrivate).toBe(true);
  const accept = await request.post(`${API}/follows/requests/${dave.user._id}/accept`, { headers: carol.headers });
  expect(accept.ok()).toBeTruthy();
  await page.reload();
  await expect(page.getByRole('link', { name: /Open post: Only for friends/ })).toBeVisible();

  // Carol blocks Dave: her profile disappears for him and he can't message her
  await request.post(`${API}/users/${dave.user._id}/block`, { headers: carol.headers });
  await page.reload();
  await expect(page.getByText('This account isn’t available')).toBeVisible();
  const dm = await request.post(`${API}/conversations`, { headers: dave.headers, data: { userId: carol.user._id } });
  expect(dm.status()).toBe(404);
});
