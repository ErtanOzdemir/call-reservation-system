import {
  CallRejectedEvent,
  CallRequestDto,
  CallStatus,
  RoutingKey,
} from '@call-reservation/shared-types';
import { Inject, Injectable } from '@nestjs/common';
import { CallRequestNotFoundError } from '../domain/errors/call-request-not-found.error';
import { CallLifecyclePolicy } from '../domain/policies/call-lifecycle.policy';
import {
  CALL_REQUEST_REPOSITORY,
  CallRequestRepositoryPort,
} from '../domain/ports/call-request-repository.port';
import { toCallRequestDto } from './to-call-request-dto';

@Injectable()
export class RejectCallUseCase {
  constructor(
    @Inject(CALL_REQUEST_REPOSITORY)
    private readonly callRequestRepository: CallRequestRepositoryPort,
  ) {}

  async execute(id: string): Promise<CallRequestDto> {
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

    const savedCallRequest = await this.callRequestRepository.save(
      rejectedCallRequest,
      { routingKey: RoutingKey.CallRejected, payload: { ...event } },
    );

    return toCallRequestDto(savedCallRequest);
  }
}
