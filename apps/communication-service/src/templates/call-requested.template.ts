import { CallRequestedEvent } from '@call-reservation/shared-types';

export interface EmailMessage {
  to: string;
  subject: string;
  body: string;
}

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
