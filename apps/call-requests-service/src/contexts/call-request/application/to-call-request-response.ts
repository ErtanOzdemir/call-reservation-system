import { CallRequestResponse } from '@call-reservation/shared-types';
import { CallRequest } from '../domain/entities/call-request.entity';

export function toCallRequestResponse(
  callRequest: CallRequest,
): CallRequestResponse {
  if (!callRequest.id || !callRequest.createdAt) {
    throw new Error(
      'Cannot map a call request without an id and createdAt to a response.',
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
    notes: callRequest.notes,
    createdAt: callRequest.createdAt.toISOString(),
  };
}
