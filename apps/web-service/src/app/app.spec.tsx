import { Role } from '@call-reservation/shared-types';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import App from './app';
import { configureApiUrl } from '../api/api-client';
import { TOKEN_STORAGE_KEY } from '../auth/auth-context';

const fetchMock = jest.fn();
const testApiUrl = 'https://call-requests-api.test';

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

function renderApp(path = '/') {
  return render(
    <MemoryRouter
      initialEntries={[path]}
      future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
    >
      <App />
    </MemoryRouter>,
  );
}

describe('App', () => {
  beforeAll(() => {
    global.fetch = fetchMock;
    configureApiUrl(testApiUrl);
  });

  beforeEach(() => {
    fetchMock.mockReset();
    localStorage.clear();
  });

  it('routes an unauthenticated visitor to sign in', async () => {
    renderApp();

    expect(
      await screen.findByRole('heading', { name: 'Sign in' }),
    ).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('restores a user session and redirects away from the admin route', async () => {
    localStorage.setItem(TOKEN_STORAGE_KEY, 'stored-token');
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        id: 'user-id',
        email: 'person@example.com',
        role: Role.USER,
      }),
    );
    fetchMock.mockResolvedValueOnce(jsonResponse([]));
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ date: '2026-08-10', availableSlots: [] }),
    );

    renderApp('/admin');

    expect(
      await screen.findByRole('heading', { name: 'User workspace' }),
    ).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledWith(
      `${testApiUrl}/auth/me`,
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer stored-token',
        }),
      }),
    );
  });

  it('signs in and routes an admin to the admin dashboard', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        accessToken: 'signed-token',
        user: {
          id: 'admin-id',
          email: 'admin@example.com',
          role: Role.ADMIN,
        },
      }),
    );
    fetchMock.mockResolvedValueOnce(jsonResponse([]));
    renderApp('/login');

    fireEvent.change(
      await screen.findByRole('textbox', { name: 'Email address' }),
      { target: { value: 'admin@example.com' } },
    );
    fireEvent.change(screen.getByLabelText('Password'), {
      target: { value: 'password123' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(
      await screen.findByRole('heading', { name: 'Admin dashboard' }),
    ).toBeTruthy();
    await waitFor(() =>
      expect(localStorage.getItem(TOKEN_STORAGE_KEY)).toBe('signed-token'),
    );
  });
});
