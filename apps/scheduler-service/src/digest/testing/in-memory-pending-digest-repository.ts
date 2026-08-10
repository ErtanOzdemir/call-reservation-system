import {
  PendingDigestInput,
  PendingDigestRepository,
} from '../pending-digest.repository';

export class InMemoryPendingDigestRepository implements PendingDigestRepository {
  private readonly queuedDates = new Set<string>();
  queueCalls: PendingDigestInput[] = [];

  async queue(digest: PendingDigestInput): Promise<boolean> {
    this.queueCalls.push(digest);

    if (this.queuedDates.has(digest.date)) {
      return false;
    }

    this.queuedDates.add(digest.date);
    return true;
  }
}
