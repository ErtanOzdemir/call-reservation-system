import type { CallStatus } from '../../enums';

export interface CallRequestResponse {
  id: string;
  email: string;
  phoneNumber: string;
  /** ISO 8601 timestamp with an explicit UTC offset. */
  scheduledAt: string;
  durationMinutes: 30;
  status: CallStatus;
  requestedByUserId: string;
  notes?: string;
  /** ISO 8601 timestamp with an explicit UTC offset. */
  createdAt: string;
}
