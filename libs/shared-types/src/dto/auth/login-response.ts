import type { AuthenticatedUserDto } from '../user';

export interface LoginResponse {
  accessToken: string;
  user: AuthenticatedUserDto;
}
