import { AuthenticatedUser } from '@call-reservation/shared-types';
import { Body, ConflictException, Controller, Post } from '@nestjs/common';
import { RegisterUserUseCase } from '../../application/register-user.use-case';
import { UserAlreadyExistsError } from '../../domain/errors/user-already-exists.error';
import { RegisterUserDto } from './dto/register-user.dto';

@Controller('users')
export class UsersController {
  constructor(private readonly registerUser: RegisterUserUseCase) {}

  @Post()
  async register(
    @Body() payload: RegisterUserDto,
  ): Promise<AuthenticatedUser> {
    try {
      return await this.registerUser.execute(payload);
    } catch (error) {
      if (error instanceof UserAlreadyExistsError) {
        throw new ConflictException(error.message);
      }

      throw error;
    }
  }
}
