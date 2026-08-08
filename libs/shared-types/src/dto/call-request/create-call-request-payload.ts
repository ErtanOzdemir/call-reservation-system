export interface CreateCallRequestPayload {
  email: string;
  phoneNumber: string;
  /** ISO 8601 timestamp with an explicit UTC offset. */
  scheduledAt: string;
}
