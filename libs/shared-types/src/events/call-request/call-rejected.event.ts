export interface CallRejectedEvent {
  requestId: string;
  email: string;
  /** ISO 8601 timestamp with an explicit UTC offset. */
  rejectedAt: string;
}
