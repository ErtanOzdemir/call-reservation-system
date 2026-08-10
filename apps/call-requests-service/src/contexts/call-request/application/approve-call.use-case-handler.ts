import { CallApprovedEvent, CallStatus, RoutingKey } from '@call-reservation/shared-types';
import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { CallRequest } from '../domain/entities/call-request.entity';
import { CallRequestNotFoundError } from '../domain/errors/call-request-not-found.error';
import { InvalidStateTransitionError } from '../domain/errors/invalid-state-transition.error';
import { CallLifecyclePolicy } from '../domain/policies/call-lifecycle.policy';
import {
  CALL_REQUEST_REPOSITORY,
  CallRequestRepositoryPort,
} from '../domain/ports/call-request-repository.port';
import { ApproveCallUseCase } from './useCase/approve-call.use-case';

@Injectable()
export class ApproveCallUseCaseHandler {
  constructor(
    @Inject(CALL_REQUEST_REPOSITORY)
    private readonly callRequestRepository: CallRequestRepositoryPort,
  ) {}

  async execute(useCase: ApproveCallUseCase): Promise<CallRequest> {
    const { id } = useCase;
    const callRequest = await this.callRequestRepository.findById(id);

    if (!callRequest) {
      throw new CallRequestNotFoundError(id);
    }

    CallLifecyclePolicy.assertTransitionAllowed(
      callRequest.status,
      CallStatus.SCHEDULED,
    );

    const approvedCallRequest = callRequest.withStatus(CallStatus.SCHEDULED);

    const event: CallApprovedEvent = {
      requestId: id,
      email: callRequest.email,
      scheduledAt: callRequest.scheduledAt.toISOString(),
      approvedAt: new Date().toISOString(),
      adminEmail: useCase.adminEmail,
    };

    const savedCallRequest = await this.callRequestRepository.transition(
      approvedCallRequest,
      callRequest.status,
      { eventId: randomUUID(), routingKey: RoutingKey.CallApproved, payload: { ...event } },
    );

    // Someone else (a concurrent approve/reject call) already moved this
    // request past REQUESTED between the read above and this write.
    if (!savedCallRequest) {
      throw new InvalidStateTransitionError(callRequest.status, CallStatus.SCHEDULED);
    }

    return savedCallRequest;
  }
}
