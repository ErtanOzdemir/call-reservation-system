/**
 * A domain event queued for delivery to queue service. Written to the same
 * document, in the same operation, as the state change it describes —
 * see the repository adapter for how atomicity is achieved.
 */
export interface OutboxEvent {
  /** Unique per outbox write, carried onto the wire with the payload — lets
   * a consumer recognize the same logical event delivered more than once
   * (e.g. two overlapping dispatcher runs publishing the same still-pending
   * record) instead of treating it as two separate events. */
  eventId: string;
  routingKey: string;
  payload: Record<string, unknown>;
}
