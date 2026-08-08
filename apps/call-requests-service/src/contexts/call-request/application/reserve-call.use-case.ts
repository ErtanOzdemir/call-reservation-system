import {
  CallRequestDto,
  CallRequestedEvent,
  CallStatus,
  CreateCallRequestPayload,
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
import { toCallRequestDto } from './to-call-request-dto';

@Injectable()
export class ReserveCallUseCase {
  constructor(
    @Inject(CALL_REQUEST_REPOSITORY)
    private readonly callRequestRepository: CallRequestRepositoryPort,
  ) {}

  async execute(
    payload: CreateCallRequestPayload,
    requestedByUserId: string,
  ): Promise<CallRequestDto> {
    const scheduledAt = new Date(payload.scheduledAt);

    WorkingHoursPolicy.assertBookable(scheduledAt, new Date());

    const hasConflict =
      await this.callRequestRepository.hasConflictingRequest(scheduledAt);

    if (hasConflict) {
      throw new SlotUnavailableError();
    }

    const callRequest = new CallRequest({
      id: randomUUID(),
      email: payload.email.trim().toLowerCase(),
      phoneNumber: payload.phoneNumber.trim(),
      scheduledAt,
      status: CallStatus.REQUESTED,
      requestedByUserId,
    });

    const event: CallRequestedEvent = {
      requestId: callRequest.id as string,
      email: callRequest.email,
      phoneNumber: callRequest.phoneNumber,
      scheduledAt: callRequest.scheduledAt.toISOString(),
      requestedByUserId: callRequest.requestedByUserId,
    };

    const savedCallRequest = await this.callRequestRepository.create(
      callRequest,
      { routingKey: RoutingKey.CallRequested, payload: { ...event } },
    );

    return toCallRequestDto(savedCallRequest);
  }
}
