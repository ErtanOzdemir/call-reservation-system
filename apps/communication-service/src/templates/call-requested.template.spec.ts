import { CallRequestedEvent } from '@call-reservation/shared-types';
import { renderCallRequestedEmail } from './call-requested.template';

describe('renderCallRequestedEmail', () => {
  it('addresses the email to the requester and mentions the scheduled time', () => {
    const event: CallRequestedEvent = {
      requestId: 'req-1',
      email: 'customer@example.com',
      phoneNumber: '+905551234567',
      scheduledAt: '2026-08-10T10:00:00+03:00',
      requestedByUserId: 'user-1',
    };

    const email = renderCallRequestedEmail(event);

    expect(email.to).toBe('customer@example.com');
    expect(email.subject).toBe('We received your call request');
    expect(email.body).toContain('2026-08-10T10:00:00+03:00');
  });
});
