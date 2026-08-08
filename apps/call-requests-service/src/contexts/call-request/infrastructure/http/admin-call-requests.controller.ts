import { CallRequestDto, Role } from '@call-reservation/shared-types';
import {
  Body,
  ConflictException,
  Controller,
  NotFoundException,
  Param,
  Patch,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../../auth/infrastructure/http/guards/jwt-auth.guard';
import { RolesGuard } from '../../../auth/infrastructure/http/guards/roles.guard';
import { Roles } from '../../../auth/infrastructure/http/roles.decorator';
import { ApproveCallUseCase } from '../../application/approve-call.use-case';
import { CancelCallUseCase } from '../../application/cancel-call.use-case';
import { MarkCalledUseCase } from '../../application/mark-called.use-case';
import { RejectCallUseCase } from '../../application/reject-call.use-case';
import { SetCallRequestNotesUseCase } from '../../application/set-call-request-notes.use-case';
import { CallRequestNotFoundError } from '../../domain/errors/call-request-not-found.error';
import { InvalidStateTransitionError } from '../../domain/errors/invalid-state-transition.error';
import { UpdateCallRequestNotesDto } from './dto/update-call-request-notes.dto';

@Controller('admin/call-requests')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class AdminCallRequestsController {
  constructor(
    private readonly approveCall: ApproveCallUseCase,
    private readonly rejectCall: RejectCallUseCase,
    private readonly cancelCall: CancelCallUseCase,
    private readonly markCalled: MarkCalledUseCase,
    private readonly setNotes: SetCallRequestNotesUseCase,
  ) {}

  @Patch(':id/approve')
  async approve(@Param('id') id: string): Promise<CallRequestDto> {
    return this.handle(() => this.approveCall.execute(id));
  }

  @Patch(':id/reject')
  async reject(@Param('id') id: string): Promise<CallRequestDto> {
    return this.handle(() => this.rejectCall.execute(id));
  }

  @Patch(':id/cancel')
  async cancel(@Param('id') id: string): Promise<CallRequestDto> {
    return this.handle(() => this.cancelCall.execute(id));
  }

  @Patch(':id/called')
  async called(@Param('id') id: string): Promise<CallRequestDto> {
    return this.handle(() => this.markCalled.execute(id));
  }

  @Patch(':id/notes')
  async updateNotes(
    @Param('id') id: string,
    @Body() body: UpdateCallRequestNotesDto,
  ): Promise<CallRequestDto> {
    return this.handle(() => this.setNotes.execute(id, body.notes));
  }

  private async handle(
    action: () => Promise<CallRequestDto>,
  ): Promise<CallRequestDto> {
    try {
      return await action();
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
