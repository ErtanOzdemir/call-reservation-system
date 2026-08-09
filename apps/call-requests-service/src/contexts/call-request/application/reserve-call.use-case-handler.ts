import {
  CallRequestedEvent,
  CallStatus,
  RoutingKey,
} from '@call-reservation/shared-types';
import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { CallRequest } from '../domain/entities/call-request.entity';
import { SlotUnavailableError } from '../domain/errors/slot-unavailable.error';
import { WorkingHoursPolicy } from '../domain/policies/working-hours.policy';
import {
  CALL_REQUEST_REPOSITORY,
  CallRequestRepositoryPort,
} from '../domain/ports/call-request-repository.port';
import { ReserveCallUseCase } from './reserve-call.use-case';

@Injectable()
export class ReserveCallUseCaseHandler {
  constructor(
    @Inject(CALL_REQUEST_REPOSITORY)
    private readonly callRequestRepository: CallRequestRepositoryPort,
  ) {}

  async execute(useCase: ReserveCallUseCase): Promise<CallRequest> {
    const scheduledAt = new Date(useCase.scheduledAt);

    WorkingHoursPolicy.assertBookable(scheduledAt, new Date());

    const hasConflict =
      await this.callRequestRepository.hasConflictingRequest(scheduledAt);

    if (hasConflict) {
      throw new SlotUnavailableError();
    }

    const callRequest = new CallRequest({
      id: randomUUID(),
      email: useCase.email.trim().toLowerCase(),
      phoneNumber: useCase.phoneNumber.trim(),
      scheduledAt,
      status: CallStatus.REQUESTED,
      requestedByUserId: useCase.requestedByUserId,
    });

    const event: CallRequestedEvent = {
      requestId: callRequest.id as string,
      email: callRequest.email,
      phoneNumber: callRequest.phoneNumber,
      scheduledAt: callRequest.scheduledAt.toISOString(),
      requestedByUserId: callRequest.requestedByUserId,
    };

    return this.callRequestRepository.create(callRequest, {
      routingKey: RoutingKey.CallRequested,
      payload: { ...event },
    });
  }
}
