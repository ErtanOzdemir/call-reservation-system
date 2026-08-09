import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  ProcessedEventDocument,
  ProcessedEventRecord,
} from './processed-event.schema';

/** MongoDB's "duplicate key" error code — thrown when the unique index on
 * eventId rejects a second claim of the same event. */
const MONGO_DUPLICATE_KEY_ERROR_CODE = 11000;

function isDuplicateKeyError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code: unknown }).code === MONGO_DUPLICATE_KEY_ERROR_CODE
  );
}

@Injectable()
export class ProcessedEventRepository {
  constructor(
    @InjectModel(ProcessedEventRecord.name)
    private readonly processedEventModel: Model<ProcessedEventDocument>,
  ) {}

  /** Atomically claims eventId. Returns false if it was already claimed —
   * the caller should treat that as "already handled" and skip. */
  async claim(eventId: string): Promise<boolean> {
    try {
      await this.processedEventModel.create({ eventId });
      return true;
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        return false;
      }
      throw error;
    }
  }

  /** Releases a claim so a redelivery can retry — call this when the work
   * done under the claim failed, never after it succeeded. */
  async release(eventId: string): Promise<void> {
    await this.processedEventModel.deleteOne({ eventId }).exec();
  }
}
