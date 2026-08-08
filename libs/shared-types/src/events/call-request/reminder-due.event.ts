export interface ReminderDueEvent {
  requestId: string;
  customerEmail: string;
  adminEmail: string;
  /** ISO 8601 timestamp with an explicit UTC offset. */
  scheduledAt: string;
}
