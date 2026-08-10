import { CallStatus } from '@call-reservation/shared-types';
import { Model } from 'mongoose';
import { ScheduledCallDocument } from '../scheduled-call.schema';
import {
  ScheduledCallInput,
  ScheduledCallRepository,
} from '../scheduled-call.repository';

export class InMemoryScheduledCallRepository extends ScheduledCallRepository {
  private readonly records = new Map<string, ScheduledCallInput>();
  upsertCalls: Array<{
    record: ScheduledCallInput;
    options?: { scheduleReminderAt: Date; eventId: string };
  }> = [];
  cancelCalls: string[] = [];

  constructor() {
    super(null as unknown as Model<ScheduledCallDocument>);
  }

  seed(record: ScheduledCallInput): void {
    this.records.set(record.requestId, record);
  }

  async upsert(
    record: ScheduledCallInput,
    options?: { scheduleReminderAt: Date; eventId: string },
  ): Promise<void> {
    this.upsertCalls.push({ record, options });
    this.records.set(record.requestId, record);
  }

  async cancel(requestId: string): Promise<void> {
    this.cancelCalls.push(requestId);
    const existing = this.records.get(requestId);

    if (existing) {
      this.records.set(requestId, {
        ...existing,
        status: CallStatus.CANCELED,
      });
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
}
