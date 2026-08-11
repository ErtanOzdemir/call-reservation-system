import { CallStatus } from '@call-reservation/shared-types';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  ScheduledCallInput,
  ScheduledCallRepository,
} from './scheduled-call.repository';
import {
  ScheduledCallDocument,
  ScheduledCallRecord,
} from './scheduled-call.schema';

@Injectable()
export class MongoScheduledCallRepository implements ScheduledCallRepository {
  constructor(
    @InjectModel(ScheduledCallRecord.name)
    private readonly scheduledCallModel: Model<ScheduledCallDocument>,
  ) {}

  /**
   * Upsert by requestId — idempotent under RabbitMQ's at-least-once
   * redelivery.
   */
  async upsert(
    record: ScheduledCallInput,
    options?: { scheduleReminderAt: Date; eventId: string },
  ): Promise<void> {
    const fieldsToSet: Record<string, unknown> = { ...record };

    if (options) {
      fieldsToSet.pendingReminder = {
        eventId: options.eventId,
        requestId: record.requestId,
        targetFireAt: options.scheduleReminderAt,
      };
    }

    await this.scheduledCallModel
      .updateOne(
        { requestId: record.requestId },
        { $set: fieldsToSet },
        { upsert: true },
      )
      .exec();
  }

  async cancel(requestId: string): Promise<void> {
    await this.scheduledCallModel
      .updateOne(
        { requestId },
        {
          $set: { status: CallStatus.CANCELED },
          $unset: { pendingReminder: '' },
        },
      )
      .exec();
  }

  async findScheduledBetween(
    start: Date,
    end: Date,
  ): Promise<ScheduledCallInput[]> {
    const records = await this.scheduledCallModel
      .find({
        status: CallStatus.SCHEDULED,
        scheduledAt: { $gte: start, $lt: end },
      })
      .sort({ scheduledAt: 1 })
      .exec();

    return records.map((record) => ({
      requestId: record.requestId,
      email: record.email,
      scheduledAt: record.scheduledAt,
      status: record.status,
      adminEmail: record.adminEmail,
    }));
  }

  async findByRequestId(requestId: string): Promise<ScheduledCallInput | null> {
    const record = await this.scheduledCallModel.findOne({ requestId }).exec();

    if (!record) {
      return null;
    }

    return {
      requestId: record.requestId,
      email: record.email,
      scheduledAt: record.scheduledAt,
      status: record.status,
      adminEmail: record.adminEmail,
    };
  }

  async findMostRecentAdminEmail(): Promise<string | null> {
    const record = await this.scheduledCallModel
      .findOne({})
      .sort({ updatedAt: -1 })
      .exec();

    return record?.adminEmail ?? null;
  }
}
