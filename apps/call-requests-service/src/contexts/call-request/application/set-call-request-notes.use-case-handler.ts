import { Inject, Injectable } from '@nestjs/common';
import { CallRequest } from '../domain/entities/call-request.entity';
import { CallRequestNotFoundError } from '../domain/errors/call-request-not-found.error';
import {
  CALL_REQUEST_REPOSITORY,
  CallRequestRepositoryPort,
} from '../domain/ports/call-request-repository.port';
import { SetCallRequestNotesUseCase } from './set-call-request-notes.use-case';

@Injectable()
export class SetCallRequestNotesUseCaseHandler {
  constructor(
    @Inject(CALL_REQUEST_REPOSITORY)
    private readonly callRequestRepository: CallRequestRepositoryPort,
  ) {}

  async execute(useCase: SetCallRequestNotesUseCase): Promise<CallRequest> {
    const callRequest = await this.callRequestRepository.setNotes(
      useCase.id,
      useCase.notes,
    );

    if (!callRequest) {
      throw new CallRequestNotFoundError(useCase.id);
    }

    return callRequest;
  }
}
