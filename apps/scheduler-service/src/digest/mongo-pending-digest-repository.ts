import { isMongoDuplicateKeyError } from '@call-reservation/shared-types';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  PendingDigestInput,
  PendingDigestRepository,
} from './pending-digest.repository';
import {
  PendingDigestDocument,
  PendingDigestRecord,
} from './pending-digest.schema';

@Injectable()
export class MongoPendingDigestRepository implements PendingDigestRepository {
  constructor(
    @InjectModel(PendingDigestRecord.name)
    private readonly pendingDigestModel: Model<PendingDigestDocument>,
  ) {}

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
