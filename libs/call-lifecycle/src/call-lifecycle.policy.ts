import { CallStatus } from '@call-reservation/shared-types';
import { InvalidStateTransitionError } from './invalid-state-transition.error';

const ALLOWED_TRANSITIONS: Record<CallStatus, CallStatus[]> = {
  [CallStatus.REQUESTED]: [CallStatus.SCHEDULED, CallStatus.REJECTED],
  [CallStatus.SCHEDULED]: [CallStatus.CALLED, CallStatus.CANCELED],
  [CallStatus.REJECTED]: [],
  [CallStatus.CALLED]: [],
  [CallStatus.CANCELED]: [],
};

export class CallLifecyclePolicy {
  /**
   * Statuses that still hold their slot — a REQUESTED or SCHEDULED request
   * blocks re-booking that scheduledAt; REJECTED/CANCELED free it back up.
   * Backs the partial unique index on scheduledAt (see call-request.schema.ts)
   * as well as every read that needs the same notion of "occupied".
   */
  static readonly ACTIVE_STATUSES: CallStatus[] = [
    CallStatus.REQUESTED,
    CallStatus.SCHEDULED,
  ];

  static isTransitionAllowed(from: CallStatus, to: CallStatus): boolean {
    return ALLOWED_TRANSITIONS[from].includes(to);
  }

  static assertTransitionAllowed(from: CallStatus, to: CallStatus): void {
    if (!this.isTransitionAllowed(from, to)) {
      throw new InvalidStateTransitionError(from, to);
    }
  }
}
