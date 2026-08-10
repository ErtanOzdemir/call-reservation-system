import { Role } from '@call-reservation/shared-types';
import { User } from '../../domain/entities/user.entity';
import { UserRepositoryPort } from '../../domain/ports/user-repository.port';

export class InMemoryUserRepository implements UserRepositoryPort {
  users: User[] = [];

  seed(user: User): void {
    this.users.push(user);
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.users.find((user) => user.email === email) ?? null;
  }

  async existsByRole(role: Role): Promise<boolean> {
    return this.users.some((user) => user.role === role);
  }

  async save(user: User): Promise<User> {
    const savedUser = new User(
      user.id ?? `${this.users.length + 1}`,
      user.email,
      user.passwordHash,
      user.role,
    );
    this.users.push(savedUser);
    return savedUser;
  }
}
