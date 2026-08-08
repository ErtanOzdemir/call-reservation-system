import { CallStatus } from '@call-reservation/shared-types';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  CallRequestDocument,
  CallRequestRecord,
} from '../../../call-request/infrastructure/mongo/call-request.schema';

@Injectable()
export class AvailabilityRepository {
  constructor(
    @InjectModel(CallRequestRecord.name)
    private readonly callRequestModel: Model<CallRequestDocument>,
  ) {}

  /**
   * Slot start times still held by an active (REQUESTED/SCHEDULED) request
   * within [dayStart, dayEnd) — REJECTED/CANCELED ones free the slot back up.
   */
  async findOccupiedSlots(dayStart: Date, dayEnd: Date): Promise<Date[]> {
    const records = await this.callRequestModel
      .find(
        {
          scheduledAt: { $gte: dayStart, $lt: dayEnd },
          status: { $in: [CallStatus.REQUESTED, CallStatus.SCHEDULED] },
        },
        { scheduledAt: 1 },
      )
      .exec();

    return records.map((record) => record.scheduledAt);
  }
}
