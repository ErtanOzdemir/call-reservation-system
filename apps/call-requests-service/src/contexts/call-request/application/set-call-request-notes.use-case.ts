import { CallRequestDto } from '@call-reservation/shared-types';
import { Inject, Injectable } from '@nestjs/common';
import { CallRequestNotFoundError } from '../domain/errors/call-request-not-found.error';
import {
  CALL_REQUEST_REPOSITORY,
  CallRequestRepositoryPort,
} from '../domain/ports/call-request-repository.port';
import { toCallRequestDto } from './to-call-request-dto';

@Injectable()
export class SetCallRequestNotesUseCase {
  constructor(
    @Inject(CALL_REQUEST_REPOSITORY)
    private readonly callRequestRepository: CallRequestRepositoryPort,
  ) {}

  async execute(id: string, notes: string): Promise<CallRequestDto> {
    const callRequest = await this.callRequestRepository.setNotes(id, notes);

    if (!callRequest) {
      throw new CallRequestNotFoundError(id);
    }

    return toCallRequestDto(callRequest);
  }
}
