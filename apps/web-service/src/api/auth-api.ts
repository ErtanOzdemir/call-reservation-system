import {
  AuthenticatedUserDto,
  LoginPayload,
  LoginResponse,
  RegisterUserPayload,
} from '@call-reservation/shared-types';

let apiUrl: string;

export function configureAuthApi(configuredApiUrl?: string): void {
  if (!configuredApiUrl?.trim()) {
    throw new Error('VITE_CALL_REQUESTS_API_URL is required.');
  }

  apiUrl = configuredApiUrl.trim().replace(/\/$/, '');
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = ApiError.name;
  }
}

async function request<T>(
  path: string,
  options: RequestInit = {},
  token?: string,
): Promise<T> {
  const response = await fetch(`${apiUrl}${path}`, {
    ...options,
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  const body = await response.json().catch(() => null);

  if (!response.ok) {
    const message = Array.isArray(body?.message)
      ? body.message.join(' ')
      : body?.message;
    throw new ApiError(
      message || 'The request could not be completed.',
      response.status,
    );
  }

  return body as T;
}

export const authApi = {
  register(payload: RegisterUserPayload): Promise<AuthenticatedUserDto> {
    return request('/users', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  login(payload: LoginPayload): Promise<LoginResponse> {
    return request('/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  getCurrentUser(token: string): Promise<AuthenticatedUserDto> {
    return request('/auth/me', {}, token);
  },
};
