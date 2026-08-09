import { CallCanceledEvent } from '@call-reservation/shared-types';
import { EmailMessage } from '../shared-kernel/email/email-message';

export function renderCallCanceledEmail(
  event: CallCanceledEvent,
): EmailMessage {
  return {
    to: event.email,
    subject: 'Your call request was canceled',
    body: 'Your scheduled call has been canceled by the admin.',
  };
}
