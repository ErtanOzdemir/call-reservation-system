import { Role } from '@call-reservation/shared-types';
import { PasswordHasherService } from '../../../shared-kernel/crypto/password-hasher.service';
import { User } from '../../user/domain/entities/user.entity';
import { UserRepositoryPort } from '../../user/domain/ports/user-repository.port';
import { InvalidCredentialsError } from '../domain/errors/invalid-credentials.error';
import { TokenIssuerPort } from '../domain/ports/token-issuer.port';
import { LoginUseCase } from './useCase/login.use-case';
import { LoginUseCaseHandler } from './login.use-case-handler';

describe('LoginUseCaseHandler', () => {
  const user = new User(
    'user-id',
    'person@example.com',
    'stored-hash',
    Role.USER,
  );
  const userRepository = {
    findByEmail: jest.fn(),
  } as unknown as UserRepositoryPort;
  const passwordHasher = {
    compare: jest.fn(),
  } as unknown as PasswordHasherService;
  const tokenIssuer = {
    issue: jest.fn(),
  } as unknown as TokenIssuerPort;
  const handler = new LoginUseCaseHandler(
    userRepository,
    passwordHasher,
    tokenIssuer,
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns a token and a password-free user response', async () => {
    jest.mocked(userRepository.findByEmail).mockResolvedValue(user);
    jest.mocked(passwordHasher.compare).mockResolvedValue(true);
    jest.mocked(tokenIssuer.issue).mockResolvedValue('signed-token');

    await expect(
      handler.execute(new LoginUseCase(' PERSON@Example.com ', 'password123')),
    ).resolves.toEqual({
      accessToken: 'signed-token',
      user: {
        id: 'user-id',
        email: 'person@example.com',
        role: Role.USER,
      },
    });
    expect(userRepository.findByEmail).toHaveBeenCalledWith(
      'person@example.com',
    );
    expect(passwordHasher.compare).toHaveBeenCalledWith(
      'password123',
      'stored-hash',
    );
  });

  it('rejects an unknown email without exposing which credential failed', async () => {
    jest.mocked(userRepository.findByEmail).mockResolvedValue(null);

    await expect(
      handler.execute(new LoginUseCase('missing@example.com', 'password123')),
    ).rejects.toBeInstanceOf(InvalidCredentialsError);
    expect(passwordHasher.compare).not.toHaveBeenCalled();
  });

  it('rejects an incorrect password', async () => {
    jest.mocked(userRepository.findByEmail).mockResolvedValue(user);
    jest.mocked(passwordHasher.compare).mockResolvedValue(false);

    await expect(
      handler.execute(
        new LoginUseCase('person@example.com', 'incorrect-password'),
      ),
    ).rejects.toBeInstanceOf(InvalidCredentialsError);
    expect(tokenIssuer.issue).not.toHaveBeenCalled();
  });
});
