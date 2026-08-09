import {
  AuthenticatedUser,
  LoginResponse,
  Role,
} from '@call-reservation/shared-types';
import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { LoginUseCase } from '../../application/useCase/login.use-case';
import { LoginUseCaseHandler } from '../../application/login.use-case-handler';
import { InvalidCredentialsError } from '../../domain/errors/invalid-credentials.error';
import { AuthenticatedRequest } from './authenticated-request';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { Roles } from './roles.decorator';

@Controller('auth')
export class AuthController {
  constructor(private readonly loginUser: LoginUseCaseHandler) {}

  @Get('me')
  @Roles(Role.USER, Role.ADMIN)
  @UseGuards(JwtAuthGuard, RolesGuard)
  getCurrentUser(@Req() request: AuthenticatedRequest): AuthenticatedUser {
    return request.user;
  }

  @Post('login')
  async login(@Body() payload: LoginDto): Promise<LoginResponse> {
    try {
      return await this.loginUser.execute(
        new LoginUseCase(payload.email, payload.password),
      );
    } catch (error) {
      if (error instanceof InvalidCredentialsError) {
        throw new UnauthorizedException(error.message);
      }

      throw error;
    }
  }
}
