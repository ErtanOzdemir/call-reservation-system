import { CallStatus } from '@call-reservation/shared-types';
import { InvalidStateTransitionError } from '../errors/invalid-state-transition.error';

const ALLOWED_TRANSITIONS: Record<CallStatus, CallStatus[]> = {
  [CallStatus.REQUESTED]: [CallStatus.SCHEDULED, CallStatus.REJECTED],
  [CallStatus.SCHEDULED]: [CallStatus.CALLED, CallStatus.CANCELED],
  [CallStatus.REJECTED]: [],
  [CallStatus.CALLED]: [],
  [CallStatus.CANCELED]: [],
};

export class CallLifecyclePolicy {
  static assertTransitionAllowed(from: CallStatus, to: CallStatus): void {
    if (!ALLOWED_TRANSITIONS[from].includes(to)) {
      throw new InvalidStateTransitionError(from, to);
    }
  }
}
