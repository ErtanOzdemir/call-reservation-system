import type { AuthenticatedUser } from '../user';

export interface LoginResponse {
  accessToken: string;
  user: AuthenticatedUser;
}
