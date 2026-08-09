import type { Role } from '../../enums';

export interface AuthenticatedUser {
  id: string;
  email: string;
  role: Role;
}
