import { AuthenticatedUser } from '@call-reservation/shared-types';
import { Inject, Injectable } from '@nestjs/common';
import { PasswordHasherService } from '../../../shared-kernel/crypto/password-hasher.service';
import { InvalidCredentialsError } from '../domain/errors/invalid-credentials.error';
import {
  TOKEN_ISSUER,
  TokenIssuerPort,
} from '../domain/ports/token-issuer.port';
import {
  USER_REPOSITORY,
  UserRepositoryPort,
} from '../../user/domain/ports/user-repository.port';
import { LoginUseCase } from './useCase/login.use-case';

export interface LoginResult {
  accessToken: string;
  user: AuthenticatedUser;
}

@Injectable()
export class LoginUseCaseHandler {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: UserRepositoryPort,
    private readonly passwordHasher: PasswordHasherService,
    @Inject(TOKEN_ISSUER)
    private readonly tokenIssuer: TokenIssuerPort,
  ) {}

  async execute(useCase: LoginUseCase): Promise<LoginResult> {
    const email = useCase.email.trim().toLowerCase();
    const user = await this.userRepository.findByEmail(email);

    if (!user) {
      throw new InvalidCredentialsError();
    }

    const passwordMatches = await this.passwordHasher.compare(
      useCase.password,
      user.passwordHash,
    );

    if (!passwordMatches || !user.id) {
      throw new InvalidCredentialsError();
    }

    const authenticatedUser: AuthenticatedUser = {
      id: user.id,
      email: user.email,
      role: user.role,
    };

    return {
      accessToken: await this.tokenIssuer.issue(authenticatedUser),
      user: authenticatedUser,
    };
  }
}
