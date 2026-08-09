import { CallRequestedEvent } from '@call-reservation/shared-types';
import { EmailMessage } from '../shared-kernel/email/email-message';

export function renderCallRequestedEmail(
  event: CallRequestedEvent,
): EmailMessage {
  return {
    to: event.email,
    subject: 'We received your call request',
    body:
      `Hi,\n\nWe received your request for a call on ${event.scheduledAt}. ` +
      "We'll email you once it's approved.\n\nThanks.",
  };
}
