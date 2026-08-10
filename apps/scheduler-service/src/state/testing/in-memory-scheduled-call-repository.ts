import { CallStatus } from '@call-reservation/shared-types';
import {
  ScheduledCallInput,
  ScheduledCallRepository,
} from '../scheduled-call.repository';

export class InMemoryScheduledCallRepository implements ScheduledCallRepository {
  private readonly records = new Map<string, ScheduledCallInput>();
  private lastAdminEmail: string | null = null;
  upsertCalls: Array<{
    record: ScheduledCallInput;
    options?: { scheduleReminderAt: Date; eventId: string };
  }> = [];
  cancelCalls: string[] = [];

  seed(record: ScheduledCallInput): void {
    this.records.set(record.requestId, record);
    this.lastAdminEmail = record.adminEmail;
  }

  async upsert(
    record: ScheduledCallInput,
    options?: { scheduleReminderAt: Date; eventId: string },
  ): Promise<void> {
    this.upsertCalls.push({ record, options });
    this.records.set(record.requestId, record);
    this.lastAdminEmail = record.adminEmail;
  }

  async cancel(requestId: string): Promise<void> {
    this.cancelCalls.push(requestId);
    const existing = this.records.get(requestId);

    if (existing) {
      this.records.set(requestId, {
        ...existing,
        status: CallStatus.CANCELED,
      });
      this.lastAdminEmail = existing.adminEmail;
    }
  }

  async findScheduledBetween(
    start: Date,
    end: Date,
  ): Promise<ScheduledCallInput[]> {
    return [...this.records.values()]
      .filter(
        (record) =>
          record.status === CallStatus.SCHEDULED &&
          record.scheduledAt >= start &&
          record.scheduledAt < end,
      )
      .sort((a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime());
  }

  async findByRequestId(requestId: string): Promise<ScheduledCallInput | null> {
    return this.records.get(requestId) ?? null;
  }

  async findMostRecentAdminEmail(): Promise<string | null> {
    return this.lastAdminEmail;
  }
}
