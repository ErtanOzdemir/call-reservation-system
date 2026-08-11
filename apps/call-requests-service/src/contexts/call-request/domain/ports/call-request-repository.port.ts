import { CallStatus } from '@call-reservation/shared-types';
import { CallRequest } from '../entities/call-request.entity';
import { OutboxEvent } from '../outbox-event';

export const CALL_REQUEST_REPOSITORY = Symbol('CALL_REQUEST_REPOSITORY');

export interface CallRequestRepositoryPort {
  create(callRequest: CallRequest, event: OutboxEvent): Promise<CallRequest>;

  /**
   * Transitions an existing request, but only if it's still in
   * `expectedCurrentStatus` (optimistic lock) when the write happens — returns null if it
   * isn't (someone else already approved/rejected/...).
   */
  transition(
    callRequest: CallRequest,
    expectedCurrentStatus: CallStatus,
    event?: OutboxEvent,
  ): Promise<CallRequest | null>;

  findById(id: string): Promise<CallRequest | null>;
  hasConflictingRequest(scheduledAt: Date): Promise<boolean>;
  findAll(): Promise<CallRequest[]>;
  findByRequestedByUserId(requestedByUserId: string): Promise<CallRequest[]>;
  setNotes(id: string, notes: string): Promise<CallRequest | null>;
}
