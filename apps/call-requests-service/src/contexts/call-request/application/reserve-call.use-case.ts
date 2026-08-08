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

    const savedCallRequest = await this.callRequestRepository.save(
      callRequest,
      { routingKey: RoutingKey.CallRequested, payload: { ...event } },
    );

    if (!savedCallRequest.id || !savedCallRequest.createdAt) {
      throw new Error(
        'The persisted call request is missing required fields.',
      );
    }

    return {
      id: savedCallRequest.id,
      email: savedCallRequest.email,
      phoneNumber: savedCallRequest.phoneNumber,
      scheduledAt: savedCallRequest.scheduledAt.toISOString(),
      durationMinutes: savedCallRequest.durationMinutes,
      status: savedCallRequest.status,
      requestedByUserId: savedCallRequest.requestedByUserId,
      createdAt: savedCallRequest.createdAt.toISOString(),
    };
  }
}
