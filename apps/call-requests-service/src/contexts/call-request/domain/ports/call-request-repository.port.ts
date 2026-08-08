import { CallRequest } from '../entities/call-request.entity';
import { OutboxEvent } from '../outbox-event';

export const CALL_REQUEST_REPOSITORY = Symbol('CALL_REQUEST_REPOSITORY');

export interface CallRequestRepositoryPort {
  save(callRequest: CallRequest, event: OutboxEvent): Promise<CallRequest>;
  hasConflictingRequest(scheduledAt: Date): Promise<boolean>;
}
