export interface CallApprovedEvent {
  requestId: string;
  email: string;
  /** ISO 8601 timestamp with an explicit UTC offset. */
  scheduledAt: string;
  /** ISO 8601 timestamp with an explicit UTC offset. */
  approvedAt: string;
  /** The approving admin's email — the only admin in the system (see
   * user registration's single-admin constraint). Scheduler stores this on
   * its own ScheduledCallRecord so reminder/digest emails don't need a
   * separately configured admin address. */
  adminEmail: string;
}
