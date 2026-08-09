import {
  AuthenticatedUser,
  RegisterUserPayload,
} from '@call-reservation/shared-types';
import { Inject, Injectable } from '@nestjs/common';
import { PasswordHasherService } from '../../../shared-kernel/crypto/password-hasher.service';
import { User } from '../domain/entities/user.entity';
import { UserAlreadyExistsError } from '../domain/errors/user-already-exists.error';
import {
  USER_REPOSITORY,
  UserRepositoryPort,
} from '../domain/ports/user-repository.port';

@Injectable()
export class RegisterUserUseCase {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: UserRepositoryPort,
    private readonly passwordHasher: PasswordHasherService,
  ) {}

  async execute(payload: RegisterUserPayload): Promise<AuthenticatedUser> {
    const email = payload.email.trim().toLowerCase();
    const existingUser = await this.userRepository.findByEmail(email);

    if (existingUser) {
      throw new UserAlreadyExistsError();
    }

    const passwordHash = await this.passwordHasher.hash(payload.password);
    const savedUser = await this.userRepository.save(
      new User(undefined, email, passwordHash, payload.role),
    );

    if (!savedUser.id) {
      throw new Error('The persisted user is missing an identifier.');
    }

    return {
      id: savedUser.id,
      email: savedUser.email,
      role: savedUser.role,
    };
  }
}
