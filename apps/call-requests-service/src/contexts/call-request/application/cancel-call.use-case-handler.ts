import { CallCanceledEvent, CallStatus, RoutingKey } from '@call-reservation/shared-types';
import { Inject, Injectable } from '@nestjs/common';
import { CallRequest } from '../domain/entities/call-request.entity';
import { CallRequestNotFoundError } from '../domain/errors/call-request-not-found.error';
import { InvalidStateTransitionError } from '../domain/errors/invalid-state-transition.error';
import { CallLifecyclePolicy } from '../domain/policies/call-lifecycle.policy';
import {
  CALL_REQUEST_REPOSITORY,
  CallRequestRepositoryPort,
} from '../domain/ports/call-request-repository.port';
import { CancelCallUseCase } from './cancel-call.use-case';

@Injectable()
export class CancelCallUseCaseHandler {
  constructor(
    @Inject(CALL_REQUEST_REPOSITORY)
    private readonly callRequestRepository: CallRequestRepositoryPort,
  ) {}

  async execute(useCase: CancelCallUseCase): Promise<CallRequest> {
    const { id } = useCase;
    const callRequest = await this.callRequestRepository.findById(id);

    if (!callRequest) {
      throw new CallRequestNotFoundError(id);
    }

    CallLifecyclePolicy.assertTransitionAllowed(
      callRequest.status,
      CallStatus.CANCELED,
    );

    const canceledCallRequest = callRequest.withStatus(CallStatus.CANCELED);

    const event: CallCanceledEvent = {
      requestId: id,
      email: callRequest.email,
      canceledAt: new Date().toISOString(),
    };

    const savedCallRequest = await this.callRequestRepository.transition(
      canceledCallRequest,
      callRequest.status,
      { routingKey: RoutingKey.CallCanceled, payload: { ...event } },
    );

    if (!savedCallRequest) {
      throw new InvalidStateTransitionError(callRequest.status, CallStatus.CANCELED);
    }

    return savedCallRequest;
  }
}
