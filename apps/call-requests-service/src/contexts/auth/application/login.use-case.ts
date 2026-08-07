import {
  AuthenticatedUserDto,
  LoginPayload,
  LoginResponse,
} from '@call-reservation/shared-types';
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

@Injectable()
export class LoginUseCase {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: UserRepositoryPort,
    private readonly passwordHasher: PasswordHasherService,
    @Inject(TOKEN_ISSUER)
    private readonly tokenIssuer: TokenIssuerPort,
  ) {}

  async execute(payload: LoginPayload): Promise<LoginResponse> {
    const email = payload.email.trim().toLowerCase();
    const user = await this.userRepository.findByEmail(email);

    if (!user) {
      throw new InvalidCredentialsError();
    }

    const passwordMatches = await this.passwordHasher.compare(
      payload.password,
      user.passwordHash,
    );

    if (!passwordMatches || !user.id) {
      throw new InvalidCredentialsError();
    }

    const authenticatedUser: AuthenticatedUserDto = {
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
