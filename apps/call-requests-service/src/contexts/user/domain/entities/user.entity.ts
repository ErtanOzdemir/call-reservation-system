import { Role } from '@call-reservation/shared-types';

export class User {
  constructor(
    readonly id: string | undefined,
    readonly email: string,
    readonly passwordHash: string,
    readonly role: Role,
  ) {}
}
