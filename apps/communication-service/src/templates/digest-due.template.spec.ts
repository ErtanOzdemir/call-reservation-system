import { DigestDueEvent } from '@call-reservation/shared-types';
import { renderDigestDueEmail } from './digest-due.template';

describe('renderDigestDueEmail', () => {
  it('lists every scheduled call for the admin', () => {
    const event: DigestDueEvent = {
      adminEmail: 'admin@call-reservation.local',
      date: '2026-08-10',
      calls: [
        {
          requestId: 'req-1',
          email: 'customer@example.com',
          scheduledAt: '2026-08-10T07:00:00.000Z',
        },
      ],
    };

    const email = renderDigestDueEmail(event);

    expect(email.to).toBe('admin@call-reservation.local');
    expect(email.subject).toBe('Daily digest: 1 call(s) scheduled for 2026-08-10');
    expect(email.body).toBe(
      'Calls scheduled for 2026-08-10:\n\n- 2026-08-10T07:00:00.000Z with customer@example.com',
    );
  });

  it('says so when nothing is scheduled', () => {
    const event: DigestDueEvent = {
      adminEmail: 'admin@call-reservation.local',
      date: '2026-08-11',
      calls: [],
    };

    const email = renderDigestDueEmail(event);

    expect(email.body).toBe('No calls are scheduled for 2026-08-11.');
  });
});
