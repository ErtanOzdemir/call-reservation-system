import { AuthenticatedUser } from '@call-reservation/shared-types';
import { Body, ConflictException, Controller, Post } from '@nestjs/common';
import { RegisterUserUseCase } from '../../application/useCase/register-user.use-case';
import { RegisterUserUseCaseHandler } from '../../application/register-user.use-case-handler';
import { UserAlreadyExistsError } from '../../domain/errors/user-already-exists.error';
import { RegisterUserDto } from './dto/register-user.dto';

@Controller('users')
export class UsersController {
  constructor(private readonly registerUser: RegisterUserUseCaseHandler) {}

  @Post()
  async register(@Body() payload: RegisterUserDto): Promise<AuthenticatedUser> {
    try {
      return await this.registerUser.execute(
        new RegisterUserUseCase(payload.email, payload.password, payload.role),
      );
    } catch (error) {
      if (error instanceof UserAlreadyExistsError) {
        throw new ConflictException(error.message);
      }

      throw error;
    }
  }
}
