import { CallApprovedEvent } from '@call-reservation/shared-types';
import { renderCallApprovedEmail } from './call-approved.template';

describe('renderCallApprovedEmail', () => {
  it('addresses the email to the requester and mentions the scheduled time', () => {
    const event: CallApprovedEvent = {
      requestId: 'req-1',
      email: 'customer@example.com',
      scheduledAt: '2026-08-10T10:00:00+03:00',
      approvedAt: '2026-08-08T09:00:00+03:00',
      adminEmail: 'admin@example.com',
    };

    const email = renderCallApprovedEmail(event);

    expect(email.to).toBe('customer@example.com');
    expect(email.subject).toBe('Your call request has been approved');
    expect(email.body).toContain('2026-08-10T10:00:00+03:00');
  });
});
