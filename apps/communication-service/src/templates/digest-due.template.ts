import { DigestDueEvent } from '@call-reservation/shared-types';
import { EmailMessage } from './call-requested.template';

export function renderDigestDueEmail(event: DigestDueEvent): EmailMessage {
  const body =
    event.calls.length === 0
      ? `No calls are scheduled for ${event.date}.`
      : [
          `Calls scheduled for ${event.date}:`,
          '',
          ...event.calls.map((call) => `- ${call.scheduledAt} with ${call.email}`),
        ].join('\n');

  return {
    to: event.adminEmail,
    subject: `Daily digest: ${event.calls.length} call(s) scheduled for ${event.date}`,
    body,
  };
}
