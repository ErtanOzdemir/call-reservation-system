export interface CallApprovedEvent {
  requestId: string;
  email: string;
  /** ISO 8601 timestamp with an explicit UTC offset. */
  scheduledAt: string;
  /** ISO 8601 timestamp with an explicit UTC offset. */
  approvedAt: string;
}
