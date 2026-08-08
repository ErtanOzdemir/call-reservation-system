import { CallRejectedEvent } from '@call-reservation/shared-types';
import { renderCallRejectedEmail } from './call-rejected.template';

describe('renderCallRejectedEmail', () => {
  it('uses the exact wording required by the spec', () => {
    const event: CallRejectedEvent = {
      requestId: 'req-1',
      email: 'customer@example.com',
      rejectedAt: '2026-08-08T09:00:00+03:00',
    };

    const email = renderCallRejectedEmail(event);

    expect(email.to).toBe('customer@example.com');
    expect(email.body).toBe(
      'Your request was rejected by the admin. Please try reserving another time.',
    );
  });
});
