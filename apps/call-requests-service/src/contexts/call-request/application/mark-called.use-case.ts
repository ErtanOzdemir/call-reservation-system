import { CallRequestDto, CallStatus } from '@call-reservation/shared-types';
import { Inject, Injectable } from '@nestjs/common';
import { CallRequestNotFoundError } from '../domain/errors/call-request-not-found.error';
import { InvalidStateTransitionError } from '../domain/errors/invalid-state-transition.error';
import { CallLifecyclePolicy } from '../domain/policies/call-lifecycle.policy';
import {
  CALL_REQUEST_REPOSITORY,
  CallRequestRepositoryPort,
} from '../domain/ports/call-request-repository.port';
import { toCallRequestDto } from './to-call-request-dto';

@Injectable()
export class MarkCalledUseCase {
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
      CallStatus.CALLED,
    );

    const calledCallRequest = callRequest.withStatus(CallStatus.CALLED);

   
    const savedCallRequest = await this.callRequestRepository.transition(
      calledCallRequest,
      callRequest.status,
    );

    
    if (!savedCallRequest) {
      throw new InvalidStateTransitionError(callRequest.status, CallStatus.CALLED);
    }

    return toCallRequestDto(savedCallRequest);
  }
}
