import { CallStatus } from '@call-reservation/shared-types';

export const SCHEDULED_CALL_REPOSITORY = Symbol('SCHEDULED_CALL_REPOSITORY');

export interface ScheduledCallInput {
  requestId: string;
  email: string;
  scheduledAt: Date;
  status: CallStatus;
}

export interface ScheduledCallRepository {
  upsert(
    record: ScheduledCallInput,
    options?: { scheduleReminderAt: Date; eventId: string },
  ): Promise<void>;

  cancel(requestId: string): Promise<void>;

  /** SCHEDULED calls whose scheduledAt falls in [start, end) — for the daily digest. */
  findScheduledBetween(start: Date, end: Date): Promise<ScheduledCallInput[]>;

  findByRequestId(requestId: string): Promise<ScheduledCallInput | null>;
}
