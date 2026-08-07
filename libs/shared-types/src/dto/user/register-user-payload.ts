import type { Role } from '../../enums';

export interface RegisterUserPayload {
  email: string;
  password: string;
  role: Role;
}
