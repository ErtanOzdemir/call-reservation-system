import {
  CallLifecyclePolicy,
  CallRejectedEvent,
  CallStatus,
  InvalidStateTransitionError,
  RoutingKey,
} from '@call-reservation/shared-types';
import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { CallRequest } from '../domain/entities/call-request.entity';
import { CallRequestNotFoundError } from '../domain/errors/call-request-not-found.error';
import {
  CALL_REQUEST_REPOSITORY,
  CallRequestRepositoryPort,
} from '../domain/ports/call-request-repository.port';
import { RejectCallUseCase } from './useCase/reject-call.use-case';

@Injectable()
export class RejectCallUseCaseHandler {
  constructor(
    @Inject(CALL_REQUEST_REPOSITORY)
    private readonly callRequestRepository: CallRequestRepositoryPort,
  ) {}

  async execute(useCase: RejectCallUseCase): Promise<CallRequest> {
    const { id } = useCase;
    const callRequest = await this.callRequestRepository.findById(id);

    if (!callRequest) {
      throw new CallRequestNotFoundError(id);
    }

    CallLifecyclePolicy.assertTransitionAllowed(
      callRequest.status,
      CallStatus.REJECTED,
    );

    const rejectedCallRequest = callRequest.withStatus(CallStatus.REJECTED);

    const event: CallRejectedEvent = {
      requestId: id,
      email: callRequest.email,
      rejectedAt: new Date().toISOString(),
    };

    const savedCallRequest = await this.callRequestRepository.transition(
      rejectedCallRequest,
      callRequest.status,
      {
        eventId: randomUUID(),
        routingKey: RoutingKey.CallRejected,
        payload: { ...event },
      },
    );

    if (!savedCallRequest) {
      throw new InvalidStateTransitionError(
        callRequest.status,
        CallStatus.REJECTED,
      );
    }

    return savedCallRequest;
  }
}
