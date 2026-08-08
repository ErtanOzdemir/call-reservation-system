import { CallStatus } from '@call-reservation/shared-types';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  ScheduledCallDocument,
  ScheduledCallRecord,
} from './scheduled-call.schema';

export interface ScheduledCallInput {
  requestId: string;
  email: string;
  scheduledAt: Date;
  status: CallStatus;
}

@Injectable()
export class ScheduledCallRepository {
  constructor(
    @InjectModel(ScheduledCallRecord.name)
    private readonly scheduledCallModel: Model<ScheduledCallDocument>,
  ) {}

  /** Upsert by requestId — idempotent under RabbitMQ's at-least-once redelivery. */
  async upsert(record: ScheduledCallInput): Promise<void> {
    await this.scheduledCallModel
      .updateOne(
        { requestId: record.requestId },
        { $set: record },
        { upsert: true },
      )
      .exec();
  }

  async findByRequestId(
    requestId: string,
  ): Promise<ScheduledCallInput | null> {
    const record = await this.scheduledCallModel.findOne({ requestId }).exec();

    if (!record) {
      return null;
    }

    return {
      requestId: record.requestId,
      email: record.email,
      scheduledAt: record.scheduledAt,
      status: record.status,
    };
  }
}
