import { CallStatus } from '@call-reservation/shared-types';
import { InvalidStateTransitionError } from '../errors/invalid-state-transition.error';
import { CallLifecyclePolicy } from './call-lifecycle.policy';

describe('CallLifecyclePolicy', () => {
  it('allows REQUESTED to move to SCHEDULED', () => {
    expect(() =>
      CallLifecyclePolicy.assertTransitionAllowed(
        CallStatus.REQUESTED,
        CallStatus.SCHEDULED,
      ),
    ).not.toThrow();
  });

  it('allows REQUESTED to move to REJECTED', () => {
    expect(() =>
      CallLifecyclePolicy.assertTransitionAllowed(
        CallStatus.REQUESTED,
        CallStatus.REJECTED,
      ),
    ).not.toThrow();
  });

  it('rejects approving an already-rejected request', () => {
    expect(() =>
      CallLifecyclePolicy.assertTransitionAllowed(
        CallStatus.REJECTED,
        CallStatus.SCHEDULED,
      ),
    ).toThrow(InvalidStateTransitionError);
  });

  it('rejects re-approving an already-scheduled request', () => {
    expect(() =>
      CallLifecyclePolicy.assertTransitionAllowed(
        CallStatus.SCHEDULED,
        CallStatus.SCHEDULED,
      ),
    ).toThrow(InvalidStateTransitionError);
  });

  it('rejects rejecting an already-scheduled request', () => {
    expect(() =>
      CallLifecyclePolicy.assertTransitionAllowed(
        CallStatus.SCHEDULED,
        CallStatus.REJECTED,
      ),
    ).toThrow(InvalidStateTransitionError);
  });
});
