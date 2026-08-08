import { CallApprovedEvent } from '@call-reservation/shared-types';
import { EmailMessage } from './call-requested.template';

export function renderCallApprovedEmail(
  event: CallApprovedEvent,
): EmailMessage {
  return {
    to: event.email,
    subject: 'Your call request has been approved',
    body:
      `Hi,\n\nYour call on ${event.scheduledAt} has been approved. ` +
      "We'll send you a reminder before it starts.\n\nThanks.",
  };
}
