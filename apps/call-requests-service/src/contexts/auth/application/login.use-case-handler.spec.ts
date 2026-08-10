import { Role } from '@call-reservation/shared-types';
import { MockPasswordHasherService } from '../../../shared-kernel/crypto/testing/mock-password-hasher.service';
import { User } from '../../user/domain/entities/user.entity';
import { InMemoryUserRepository } from '../../user/application/testing/in-memory-user-repository';
import { InvalidCredentialsError } from '../domain/errors/invalid-credentials.error';
import { MockTokenIssuer, MOCK_ISSUED_TOKEN } from './testing/mock-token-issuer';
import { LoginUseCase } from './useCase/login.use-case';
import { LoginUseCaseHandler } from './login.use-case-handler';

describe('LoginUseCaseHandler', () => {
  const user = new User(
    'user-id',
    'person@example.com',
    'hashed:password123',
    Role.USER,
  );

  let userRepository: InMemoryUserRepository;
  let passwordHasher: MockPasswordHasherService;
  let tokenIssuer: MockTokenIssuer;
  let handler: LoginUseCaseHandler;

  beforeEach(() => {
    userRepository = new InMemoryUserRepository();
    passwordHasher = new MockPasswordHasherService();
    tokenIssuer = new MockTokenIssuer();
    handler = new LoginUseCaseHandler(userRepository, passwordHasher, tokenIssuer);
  });

  it('returns a token and a password-free user response', async () => {
    userRepository.seed(user);
    const findByEmail = jest.spyOn(userRepository, 'findByEmail');

    await expect(
      handler.execute(new LoginUseCase(' PERSON@Example.com ', 'password123')),
    ).resolves.toEqual({
      accessToken: MOCK_ISSUED_TOKEN,
      user: {
        id: 'user-id',
        email: 'person@example.com',
        role: Role.USER,
      },
    });
    expect(findByEmail).toHaveBeenCalledWith('person@example.com');
    expect(passwordHasher.compareCalls).toEqual([
      { password: 'password123', passwordHash: 'hashed:password123' },
    ]);
  });

  it('rejects an unknown email without exposing which credential failed', async () => {
    await expect(
      handler.execute(new LoginUseCase('missing@example.com', 'password123')),
    ).rejects.toBeInstanceOf(InvalidCredentialsError);
    expect(passwordHasher.compareCalls).toEqual([]);
  });

  it('rejects an incorrect password', async () => {
    userRepository.seed(user);

    await expect(
      handler.execute(
        new LoginUseCase('person@example.com', 'incorrect-password'),
      ),
    ).rejects.toBeInstanceOf(InvalidCredentialsError);
    expect(tokenIssuer.issuedFor).toEqual([]);
  });
});
