import { CallRequestResponse, Role } from '@call-reservation/shared-types';
import {
  Body,
  ConflictException,
  Controller,
  Get,
  NotFoundException,
  Param,
  Patch,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../../auth/infrastructure/http/guards/jwt-auth.guard';
import { RolesGuard } from '../../../auth/infrastructure/http/guards/roles.guard';
import { Roles } from '../../../auth/infrastructure/http/roles.decorator';
import { ApproveCallUseCase } from '../../application/useCase/approve-call.use-case';
import { ApproveCallUseCaseHandler } from '../../application/approve-call.use-case-handler';
import { CancelCallUseCase } from '../../application/useCase/cancel-call.use-case';
import { CancelCallUseCaseHandler } from '../../application/cancel-call.use-case-handler';
import { ListCallRequestsUseCaseHandler } from '../../application/list-call-requests.use-case-handler';
import { MarkCalledUseCase } from '../../application/useCase/mark-called.use-case';
import { MarkCalledUseCaseHandler } from '../../application/mark-called.use-case-handler';
import { RejectCallUseCase } from '../../application/useCase/reject-call.use-case';
import { RejectCallUseCaseHandler } from '../../application/reject-call.use-case-handler';
import { SetCallRequestNotesUseCase } from '../../application/useCase/set-call-request-notes.use-case';
import { SetCallRequestNotesUseCaseHandler } from '../../application/set-call-request-notes.use-case-handler';
import { toCallRequestResponse } from '../../application/to-call-request-response';
import { CallRequest } from '../../domain/entities/call-request.entity';
import { CallRequestNotFoundError } from '../../domain/errors/call-request-not-found.error';
import { InvalidStateTransitionError } from '../../domain/errors/invalid-state-transition.error';
import { UpdateCallRequestNotesDto } from './dto/update-call-request-notes.dto';

@Controller('admin/call-requests')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class AdminCallRequestsController {
  constructor(
    private readonly approveCall: ApproveCallUseCaseHandler,
    private readonly rejectCall: RejectCallUseCaseHandler,
    private readonly cancelCall: CancelCallUseCaseHandler,
    private readonly markCalled: MarkCalledUseCaseHandler,
    private readonly setNotes: SetCallRequestNotesUseCaseHandler,
    private readonly listCallRequests: ListCallRequestsUseCaseHandler,
  ) {}

  @Get()
  async list(): Promise<CallRequestResponse[]> {
    const callRequests = await this.listCallRequests.execute();
    return callRequests.map(toCallRequestResponse);
  }

  @Patch(':id/approve')
  async approve(@Param('id') id: string): Promise<CallRequestResponse> {
    return this.handle(() =>
      this.approveCall.execute(new ApproveCallUseCase(id)),
    );
  }

  @Patch(':id/reject')
  async reject(@Param('id') id: string): Promise<CallRequestResponse> {
    return this.handle(() =>
      this.rejectCall.execute(new RejectCallUseCase(id)),
    );
  }

  @Patch(':id/cancel')
  async cancel(@Param('id') id: string): Promise<CallRequestResponse> {
    return this.handle(() =>
      this.cancelCall.execute(new CancelCallUseCase(id)),
    );
  }

  @Patch(':id/called')
  async called(@Param('id') id: string): Promise<CallRequestResponse> {
    return this.handle(() =>
      this.markCalled.execute(new MarkCalledUseCase(id)),
    );
  }

  @Patch(':id/notes')
  async updateNotes(
    @Param('id') id: string,
    @Body() body: UpdateCallRequestNotesDto,
  ): Promise<CallRequestResponse> {
    return this.handle(() =>
      this.setNotes.execute(new SetCallRequestNotesUseCase(id, body.notes)),
    );
  }

  private async handle(
    action: () => Promise<CallRequest>,
  ): Promise<CallRequestResponse> {
    try {
      return toCallRequestResponse(await action());
    } catch (error) {
      if (error instanceof CallRequestNotFoundError) {
        throw new NotFoundException(error.message);
      }

      if (error instanceof InvalidStateTransitionError) {
        throw new ConflictException(error.message);
      }

      throw error;
    }
  }
}
