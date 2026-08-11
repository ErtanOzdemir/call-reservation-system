import {
  CallLifecyclePolicy,
  CallStatus,
  InvalidStateTransitionError,
} from '@call-reservation/shared-types';
import { Inject, Injectable } from '@nestjs/common';
import { CallRequest } from '../domain/entities/call-request.entity';
import { CallRequestNotFoundError } from '../domain/errors/call-request-not-found.error';
import {
  CALL_REQUEST_REPOSITORY,
  CallRequestRepositoryPort,
} from '../domain/ports/call-request-repository.port';
import { MarkCalledUseCase } from './useCase/mark-called.use-case';

@Injectable()
export class MarkCalledUseCaseHandler {
  constructor(
    @Inject(CALL_REQUEST_REPOSITORY)
    private readonly callRequestRepository: CallRequestRepositoryPort,
  ) {}

  async execute(useCase: MarkCalledUseCase): Promise<CallRequest> {
    const { id } = useCase;
    const callRequest = await this.callRequestRepository.findById(id);

    if (!callRequest) {
      throw new CallRequestNotFoundError(id);
    }

    CallLifecyclePolicy.assertTransitionAllowed(
      callRequest.status,
      CallStatus.CALLED,
    );

    const calledCallRequest = callRequest.withStatus(CallStatus.CALLED);

    const savedCallRequest = await this.callRequestRepository.transition(
      calledCallRequest,
      callRequest.status,
    );

    if (!savedCallRequest) {
      throw new InvalidStateTransitionError(
        callRequest.status,
        CallStatus.CALLED,
      );
    }

    return savedCallRequest;
  }
}
