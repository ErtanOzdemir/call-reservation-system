export const PROCESSED_EVENT_REPOSITORY = Symbol('PROCESSED_EVENT_REPOSITORY');

export interface ProcessedEventRepository {
  /** Atomically claims eventId. Returns false if it was already claimed —
   * the caller should treat that as "already handled" and skip. */
  claim(eventId: string): Promise<boolean>;

  /** Releases a claim so a redelivery can retry — call this when the work
   * done under the claim failed, never after it succeeded. */
  release(eventId: string): Promise<void>;
}
