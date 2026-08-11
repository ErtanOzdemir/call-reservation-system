import { CallStatus } from '../enums/call-request/call-status';

export class InvalidStateTransitionError extends Error {
  constructor(from: CallStatus, to: CallStatus) {
    super(`Cannot transition a call request from ${from} to ${to}.`);
    this.name = InvalidStateTransitionError.name;
  }
}
