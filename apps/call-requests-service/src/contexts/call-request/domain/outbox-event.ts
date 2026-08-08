/**
 * A domain event queued for delivery to queue service. Written to the same
 * document, in the same operation, as the state change it describes —
 * see the repository adapter for how atomicity is achieved.
 */
export interface OutboxEvent {
  routingKey: string;
  payload: Record<string, unknown>;
}
