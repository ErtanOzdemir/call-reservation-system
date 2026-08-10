export const PENDING_DIGEST_REPOSITORY = Symbol('PENDING_DIGEST_REPOSITORY');

export interface PendingDigestInput {
  date: string;
  eventId: string;
  payload: Record<string, unknown>;
}

export interface PendingDigestRepository {
  /** Queues a digest for `date`. Returns false if one was already queued —
   * the caller should treat that as "already handled" and skip. */
  queue(digest: PendingDigestInput): Promise<boolean>;
}
