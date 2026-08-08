import { CallStatus } from '@call-reservation/shared-types';
import { CallRequest } from '../entities/call-request.entity';
import { OutboxEvent } from '../outbox-event';

export const CALL_REQUEST_REPOSITORY = Symbol('CALL_REQUEST_REPOSITORY');

export interface CallRequestRepositoryPort {
  /** Creates a brand-new request (reserve only) — id is always a fresh UUID, never conflicts. */
  create(callRequest: CallRequest, event: OutboxEvent): Promise<CallRequest>;

  /**
   * Transitions an existing request, but only if it's still in
   * `expectedCurrentStatus` when the write happens — returns null if it
   * isn't (someone else already approved/rejected/... it between this
   * call's read and write). Every status-changing use-case (approve,
   * reject, cancel, mark-called) goes through this, not `create`, so the
   * same-request race is closed once here rather than needing to be
   * remembered per use-case. `event` is omitted when the transition (e.g.
   * mark-called) has nothing to publish.
   */
  transition(
    callRequest: CallRequest,
    expectedCurrentStatus: CallStatus,
    event?: OutboxEvent,
  ): Promise<CallRequest | null>;

  findById(id: string): Promise<CallRequest | null>;
  hasConflictingRequest(scheduledAt: Date): Promise<boolean>;

  /** Admin free-text annotation — no status precondition, no outbox event. */
  setNotes(id: string, notes: string): Promise<CallRequest | null>;
}
