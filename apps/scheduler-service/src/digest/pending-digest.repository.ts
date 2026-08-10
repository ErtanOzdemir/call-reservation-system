import { isMongoDuplicateKeyError } from '@call-reservation/shared-types';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  PendingDigestDocument,
  PendingDigestRecord,
} from './pending-digest.schema';

export interface PendingDigestInput {
  date: string;
  eventId: string;
  payload: Record<string, unknown>;
}

@Injectable()
export class PendingDigestRepository {
  constructor(
    @InjectModel(PendingDigestRecord.name)
    private readonly pendingDigestModel: Model<PendingDigestDocument>,
  ) {}

  /** Queues a digest for `date`. Returns false if one was already queued —
   * the unique index on `date` is the guard, so the caller should treat
   * that as "already handled" and skip. */
  async queue(digest: PendingDigestInput): Promise<boolean> {
    try {
      await this.pendingDigestModel.create(digest);
      return true;
    } catch (error) {
      if (isMongoDuplicateKeyError(error)) {
        return false;
      }
      throw error;
    }
  }
}
