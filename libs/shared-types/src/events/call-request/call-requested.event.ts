export interface CallRequestedEvent {
  requestId: string;
  email: string;
  phoneNumber: string;
  /** ISO 8601 timestamp with an explicit UTC offset. */
  scheduledAt: string;
  requestedByUserId: string;
}
