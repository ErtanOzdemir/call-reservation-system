import { Role } from '@call-reservation/shared-types';

export class RegisterUserUseCase {
  constructor(
    public readonly email: string,
    public readonly password: string,
    public readonly role: Role,
  ) {}
}
