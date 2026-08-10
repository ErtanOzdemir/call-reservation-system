import { Role } from '@call-reservation/shared-types';
import { MockPasswordHasherService } from '../../../shared-kernel/crypto/testing/mock-password-hasher.service';
import { User } from '../domain/entities/user.entity';
import { UserAlreadyExistsError } from '../domain/errors/user-already-exists.error';
import { InMemoryUserRepository } from './testing/in-memory-user-repository';
import { RegisterUserUseCase } from './useCase/register-user.use-case';
import { RegisterUserUseCaseHandler } from './register-user.use-case-handler';

describe('RegisterUserUseCaseHandler', () => {
  let passwordHasher: MockPasswordHasherService;

  beforeEach(() => {
    passwordHasher = new MockPasswordHasherService();
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
    expect(passwordHasher.hashCalls).toEqual(['password123']);
    expect(repository.users[0]?.passwordHash).toBe('hashed:password123');
  });

  it('rejects a duplicate normalized email', async () => {
    const repository = new InMemoryUserRepository();
    repository.seed(
      new User('existing-id', 'person@example.com', 'hash', Role.USER),
    );
    const handler = new RegisterUserUseCaseHandler(repository, passwordHasher);

    await expect(
      handler.execute(
        new RegisterUserUseCase('PERSON@example.com', 'password123', Role.USER),
      ),
    ).rejects.toBeInstanceOf(UserAlreadyExistsError);
    expect(passwordHasher.hashCalls).toEqual([]);
  });
});
