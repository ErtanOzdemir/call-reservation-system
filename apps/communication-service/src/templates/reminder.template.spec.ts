import { ReminderDueEvent } from '@call-reservation/shared-types';
import { renderReminderEmails } from './reminder.template';

describe('renderReminderEmails', () => {
  it('produces one email for the customer and one for the admin', () => {
    const event: ReminderDueEvent = {
      requestId: 'req-1',
      customerEmail: 'customer@example.com',
      adminEmail: 'admin@call-reservation.local',
      scheduledAt: '2026-08-10T10:00:00+03:00',
    };

    const emails = renderReminderEmails(event);

    expect(emails).toHaveLength(2);
    expect(emails[0].to).toBe('customer@example.com');
    expect(emails[1].to).toBe('admin@call-reservation.local');
    expect(emails[0].body).toContain('2026-08-10T10:00:00+03:00');
    expect(emails[1].body).toContain('customer@example.com');
  });
});
