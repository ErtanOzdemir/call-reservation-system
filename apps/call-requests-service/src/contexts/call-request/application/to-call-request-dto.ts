import { CallRequestDto } from '@call-reservation/shared-types';
import { CallRequest } from '../domain/entities/call-request.entity';

export function toCallRequestDto(callRequest: CallRequest): CallRequestDto {
  if (!callRequest.id || !callRequest.createdAt) {
    throw new Error(
      'Cannot map a call request without an id and createdAt to a DTO.',
    );
  }

  return {
    id: callRequest.id,
    email: callRequest.email,
    phoneNumber: callRequest.phoneNumber,
    scheduledAt: callRequest.scheduledAt.toISOString(),
    durationMinutes: callRequest.durationMinutes,
    status: callRequest.status,
    requestedByUserId: callRequest.requestedByUserId,
    createdAt: callRequest.createdAt.toISOString(),
  };
}
