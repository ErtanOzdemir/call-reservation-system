import { CallCanceledEvent } from '@call-reservation/shared-types';
import { renderCallCanceledEmail } from './call-canceled.template';

describe('renderCallCanceledEmail', () => {
  it('addresses the email to the customer and explains the cancellation', () => {
    const event: CallCanceledEvent = {
      requestId: 'req-1',
      email: 'customer@example.com',
      canceledAt: '2026-08-08T09:00:00+03:00',
    };

    const email = renderCallCanceledEmail(event);

    expect(email.to).toBe('customer@example.com');
    expect(email.body).toBe(
      'Your scheduled call has been canceled by the admin.',
    );
  });
});
