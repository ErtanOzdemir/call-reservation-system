import { CallRejectedEvent } from '@call-reservation/shared-types';
import { EmailMessage } from '../shared-kernel/email/email-message';

export function renderCallRejectedEmail(
  event: CallRejectedEvent,
): EmailMessage {
  return {
    to: event.email,
    subject: 'Your call request was rejected',
    body: 'Your request was rejected by the admin. Please try reserving another time.',
  };
}
