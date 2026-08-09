import {
  AuthenticatedUser,
  LoginPayload,
  LoginResponse,
  RegisterUserPayload,
} from '@call-reservation/shared-types';
import { request } from './api-client';

export const authApi = {
  register(payload: RegisterUserPayload): Promise<AuthenticatedUser> {
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

  getCurrentUser(token: string): Promise<AuthenticatedUser> {
    return request('/auth/me', {}, token);
  },
};
