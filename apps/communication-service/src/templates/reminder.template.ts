import { ReminderDueEvent } from '@call-reservation/shared-types';
import { EmailMessage } from './call-requested.template';


export function renderReminderEmails(event: ReminderDueEvent): EmailMessage[] {
  return [
    {
      to: event.customerEmail,
      subject: 'Reminder: your call starts in 2 hours',
      body: `Hi,\n\nThis is a reminder that your call is scheduled for ${event.scheduledAt}.\n\nThanks.`,
    },
    {
      to: event.adminEmail,
      subject: 'Reminder: upcoming call in 2 hours',
      body: `You have a scheduled call at ${event.scheduledAt} with ${event.customerEmail}.`,
    },
  ];
}
