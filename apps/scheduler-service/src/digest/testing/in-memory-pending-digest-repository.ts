import { Model } from 'mongoose';
import { PendingDigestDocument } from '../pending-digest.schema';
import {
  PendingDigestInput,
  PendingDigestRepository,
} from '../pending-digest.repository';

export class InMemoryPendingDigestRepository extends PendingDigestRepository {
  private readonly queuedDates = new Set<string>();
  queueCalls: PendingDigestInput[] = [];

  constructor() {
    super(null as unknown as Model<PendingDigestDocument>);
  }

  async queue(digest: PendingDigestInput): Promise<boolean> {
    this.queueCalls.push(digest);

    if (this.queuedDates.has(digest.date)) {
      return false;
    }

    this.queuedDates.add(digest.date);
    return true;
  }
}
