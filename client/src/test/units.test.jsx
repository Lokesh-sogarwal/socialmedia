import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { RichText } from '../components/RichText.jsx';
import { passwordStrength, passwordRule, usernameRule, applyServerErrors } from '../lib/validation.js';
import { request, setAccessToken, ApiError } from '../lib/api.js';
import { ErrorState, EmptyState } from '../components/ui/States.jsx';

describe('validation', () => {
  it('rates password strength like the original register form', () => {
    expect(passwordStrength('short').label).toBe('Too short');
    expect(passwordStrength('aaaaaaaa').label).toBe('Weak');
    expect(passwordStrength('abcdefg1').label).toBe('Medium');
    expect(passwordStrength('Abcdef1!').label).toBe('Strong');
  });
  it('mirrors server rules', () => {
    expect(passwordRule.safeParse('password').success).toBe(false);
    expect(passwordRule.safeParse('passw0rd').success).toBe(true);
    expect(usernameRule.safeParse('no spaces').success).toBe(false);
    expect(usernameRule.safeParse('ok_name.1').success).toBe(true);
  });
  it('maps server field errors onto the form', () => {
    const setError = vi.fn();
    applyServerErrors({ message: 'taken', details: { field: 'username' } }, setError);
    expect(setError).toHaveBeenCalledWith('username', { message: 'taken' });
    setError.mockClear();
    applyServerErrors({ message: 'boom' }, setError);
    expect(setError).toHaveBeenCalledWith('root', { message: 'boom' });
  });
});

describe('RichText', () => {
  it('links hashtags and mentions and never renders HTML', () => {
    render(
      <MemoryRouter>
        <RichText text={'Hi @alice see #Sunset <img src=x onerror=alert(1)>'} />
      </MemoryRouter>,
    );
    expect(screen.getByRole('link', { name: '#Sunset' })).toHaveAttribute('href', '/explore/tags/sunset');
    expect(screen.getByRole('link', { name: '@alice' })).toHaveAttribute('href', '/u/alice');
    expect(document.querySelector('img')).toBeNull();
    expect(screen.getByText(/<img src=x/)).toBeInTheDocument();
  });
});

describe('states', () => {
  it('error state offers retry', async () => {
    const onRetry = vi.fn();
    render(<ErrorState error={new Error('Server down')} onRetry={onRetry} />);
    expect(screen.getByRole('alert')).toHaveTextContent('Server down');
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(onRetry).toHaveBeenCalled();
  });
  it('empty state renders title and description', () => {
    render(<EmptyState title="Nothing here" description="Add something" />);
    expect(screen.getByText('Nothing here')).toBeInTheDocument();
  });
});

describe('api client', () => {
  beforeEach(() => setAccessToken(null));

  it('refreshes once on 401 and retries the request', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ success: false, error: { code: 'UNAUTHORIZED', message: 'no' } }), { status: 401 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ success: true, data: { accessToken: 'new', user: {} } }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ success: true, data: { ok: 1 } }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    setAccessToken('old');
    const res = await request('/feed');
    expect(res.data).toEqual({ ok: 1 });
    expect(fetchMock.mock.calls[1][0].toString()).toContain('/api/auth/refresh');
    expect(fetchMock.mock.calls[2][1].headers.Authorization).toBe('Bearer new');
  });

  it('surfaces API errors with status and details', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: false, error: { code: 'BAD_REQUEST', message: 'Invalid', details: [{ path: 'body.x', message: 'bad' }] } }), { status: 400 })));
    await expect(request('/posts')).rejects.toMatchObject({ status: 400, message: 'Invalid' });
    await expect(request('/posts')).rejects.toBeInstanceOf(ApiError);
  });

  it('reports network failures clearly', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    await expect(request('/posts')).rejects.toMatchObject({ code: 'NETWORK' });
  });
});
