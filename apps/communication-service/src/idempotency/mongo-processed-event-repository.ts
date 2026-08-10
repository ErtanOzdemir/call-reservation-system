import { isMongoDuplicateKeyError } from '@call-reservation/shared-types';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ProcessedEventRepository } from './processed-event.repository';
import {
  ProcessedEventDocument,
  ProcessedEventRecord,
} from './processed-event.schema';

@Injectable()
export class MongoProcessedEventRepository implements ProcessedEventRepository {
  constructor(
    @InjectModel(ProcessedEventRecord.name)
    private readonly processedEventModel: Model<ProcessedEventDocument>,
  ) {}

  async claim(eventId: string): Promise<boolean> {
    try {
      await this.processedEventModel.create({ eventId });
      return true;
    } catch (error) {
      if (isMongoDuplicateKeyError(error)) {
        return false;
      }
      throw error;
    }
  }

  async release(eventId: string): Promise<void> {
    await this.processedEventModel.deleteOne({ eventId }).exec();
  }
}
