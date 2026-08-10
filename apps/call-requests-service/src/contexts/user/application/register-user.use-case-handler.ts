import { AuthenticatedUser, Role } from '@call-reservation/shared-types';
import { Inject, Injectable } from '@nestjs/common';
import { PasswordHasherService } from '../../../shared-kernel/crypto/password-hasher.service';
import { User } from '../domain/entities/user.entity';
import { AdminAlreadyExistsError } from '../domain/errors/admin-already-exists.error';
import { UserAlreadyExistsError } from '../domain/errors/user-already-exists.error';
import {
  USER_REPOSITORY,
  UserRepositoryPort,
} from '../domain/ports/user-repository.port';
import { RegisterUserUseCase } from './useCase/register-user.use-case';

@Injectable()
export class RegisterUserUseCaseHandler {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: UserRepositoryPort,
    private readonly passwordHasher: PasswordHasherService,
  ) {}

  async execute(useCase: RegisterUserUseCase): Promise<AuthenticatedUser> {
    const email = useCase.email.trim().toLowerCase();
    const existingUser = await this.userRepository.findByEmail(email);

    if (existingUser) {
      throw new UserAlreadyExistsError();
    }

    if (useCase.role === Role.ADMIN) {
      const adminExists = await this.userRepository.existsByRole(Role.ADMIN);

      if (adminExists) {
        throw new AdminAlreadyExistsError();
      }
    }

    const passwordHash = await this.passwordHasher.hash(useCase.password);
    const savedUser = await this.userRepository.save(
      new User(undefined, email, passwordHash, useCase.role),
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
