import { CallRequestResponse, Role } from '@call-reservation/shared-types';
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
import { ListMyCallRequestsUseCase } from '../../application/useCase/list-my-call-requests.use-case';
import { ListMyCallRequestsUseCaseHandler } from '../../application/list-my-call-requests.use-case-handler';
import { ReserveCallUseCase } from '../../application/useCase/reserve-call.use-case';
import { ReserveCallUseCaseHandler } from '../../application/reserve-call.use-case-handler';
import { toCallRequestResponse } from '../../application/to-call-request-response';
import { InvalidReservationTimeError } from '../../domain/errors/invalid-reservation-time.error';
import { SlotUnavailableError } from '../../domain/errors/slot-unavailable.error';
import { CreateCallRequestDto } from './dto/create-call-request.dto';

@Controller('call-requests')
export class CallRequestsController {
  constructor(
    private readonly reserveCall: ReserveCallUseCaseHandler,
    private readonly listMyCallRequests: ListMyCallRequestsUseCaseHandler,
  ) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.USER, Role.ADMIN)
  async create(
    @Body() payload: CreateCallRequestDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<CallRequestResponse> {
    try {
      const callRequest = await this.reserveCall.execute(
        new ReserveCallUseCase(
          payload.email,
          payload.phoneNumber,
          payload.scheduledAt,
          request.user.id,
        ),
      );
      return toCallRequestResponse(callRequest);
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
  ): Promise<Omit<CallRequestResponse, 'notes'>[]> {
    const callRequests = await this.listMyCallRequests.execute(
      new ListMyCallRequestsUseCase(request.user.id),
    );
    return callRequests.map(toCallRequestResponse);
  }
}
