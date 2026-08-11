import { ProcessedEventRepository } from '../processed-event.repository';

export class InMemoryProcessedEventRepository implements ProcessedEventRepository {
  private readonly claimed = new Set<string>();
  claimCalls: string[] = [];
  releaseCalls: string[] = [];

  async claim(eventId: string): Promise<boolean> {
    this.claimCalls.push(eventId);

    if (this.claimed.has(eventId)) {
      return false;
    }

    this.claimed.add(eventId);
    return true;
  }

  async release(eventId: string): Promise<void> {
    this.releaseCalls.push(eventId);
    this.claimed.delete(eventId);
  }
}
