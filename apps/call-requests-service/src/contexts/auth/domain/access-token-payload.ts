import { Role } from '@call-reservation/shared-types';

export interface AccessTokenPayload {
  sub: string;
  email: string;
  role: Role;
}
