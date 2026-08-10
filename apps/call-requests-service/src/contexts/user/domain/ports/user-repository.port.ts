import { Role } from '@call-reservation/shared-types';
import { User } from '../entities/user.entity';

export const USER_REPOSITORY = Symbol('USER_REPOSITORY');

export interface UserRepositoryPort {
  findByEmail(email: string): Promise<User | null>;
  existsByRole(role: Role): Promise<boolean>;
  save(user: User): Promise<User>;
}
