import { Role } from '@call-reservation/shared-types';
import { PasswordHasherService } from '../../../shared-kernel/crypto/password-hasher.service';
import { User } from '../domain/entities/user.entity';
import { UserAlreadyExistsError } from '../domain/errors/user-already-exists.error';
import { UserRepositoryPort } from '../domain/ports/user-repository.port';
import { RegisterUserUseCase } from './useCase/register-user.use-case';
import { RegisterUserUseCaseHandler } from './register-user.use-case-handler';

class InMemoryUserRepository implements UserRepositoryPort {
  users: User[] = [];

  async findByEmail(email: string): Promise<User | null> {
    return this.users.find((user) => user.email === email) ?? null;
  }

  async save(user: User): Promise<User> {
    const savedUser = new User(
      `${this.users.length + 1}`,
      user.email,
      user.passwordHash,
      user.role,
    );
    this.users.push(savedUser);
    return savedUser;
  }
}

describe('RegisterUserUseCaseHandler', () => {
  const passwordHasher = {
    hash: jest.fn(async () => 'hashed-password'),
  } as unknown as PasswordHasherService;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('hashes and persists a normalized user', async () => {
    const repository = new InMemoryUserRepository();
    const handler = new RegisterUserUseCaseHandler(repository, passwordHasher);

    await expect(
      handler.execute(
        new RegisterUserUseCase(
          ' Admin@Example.com ',
          'password123',
          Role.ADMIN,
        ),
      ),
    ).resolves.toEqual({
      id: '1',
      email: 'admin@example.com',
      role: Role.ADMIN,
    });
    expect(passwordHasher.hash).toHaveBeenCalledWith('password123');
    expect(repository.users[0]?.passwordHash).toBe('hashed-password');
  });

  it('rejects a duplicate normalized email', async () => {
    const repository = new InMemoryUserRepository();
    repository.users.push(
      new User('existing-id', 'person@example.com', 'hash', Role.USER),
    );
    const handler = new RegisterUserUseCaseHandler(repository, passwordHasher);

    await expect(
      handler.execute(
        new RegisterUserUseCase('PERSON@example.com', 'password123', Role.USER),
      ),
    ).rejects.toBeInstanceOf(UserAlreadyExistsError);
    expect(passwordHasher.hash).not.toHaveBeenCalled();
  });
});
