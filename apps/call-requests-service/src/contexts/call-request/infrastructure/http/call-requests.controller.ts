import { CallRequestDto, Role } from '@call-reservation/shared-types';
import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Get,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthenticatedRequest } from '../../../auth/infrastructure/http/authenticated-request';
import { JwtAuthGuard } from '../../../auth/infrastructure/http/guards/jwt-auth.guard';
import { RolesGuard } from '../../../auth/infrastructure/http/guards/roles.guard';
import { Roles } from '../../../auth/infrastructure/http/roles.decorator';
import { ListMyCallRequestsUseCase } from '../../application/list-my-call-requests.use-case';
import { ReserveCallUseCase } from '../../application/reserve-call.use-case';
import { InvalidReservationTimeError } from '../../domain/errors/invalid-reservation-time.error';
import { SlotUnavailableError } from '../../domain/errors/slot-unavailable.error';
import { CreateCallRequestDto } from './dto/create-call-request.dto';

@Controller('call-requests')
export class CallRequestsController {
  constructor(
    private readonly reserveCall: ReserveCallUseCase,
    private readonly listMyCallRequests: ListMyCallRequestsUseCase,
  ) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.USER, Role.ADMIN)
  async create(
    @Body() payload: CreateCallRequestDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<CallRequestDto> {
    try {
      return await this.reserveCall.execute(payload, request.user.id);
    } catch (error) {
      if (error instanceof InvalidReservationTimeError) {
        throw new BadRequestException(error.message);
      }

      if (error instanceof SlotUnavailableError) {
        throw new ConflictException(error.message);
      }

      throw error;
    }
  }

  @Get('mine')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.USER, Role.ADMIN)
  async mine(
    @Req() request: AuthenticatedRequest,
  ): Promise<Omit<CallRequestDto, 'notes'>[]> {
    return this.listMyCallRequests.execute(request.user.id);
  }
}
