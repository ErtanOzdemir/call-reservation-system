export interface AvailabilitySlot {
  /** ISO 8601 timestamp (with UTC offset) of the slot start. */
  time: string;
  available: boolean;
}

export interface AvailabilityResponse {
  /** The Istanbul-local calendar day this availability was computed for, e.g. "2026-08-10". */
  date: string;
  /** Every bookable 30-minute slot for the day, in order, each flagged as available or not. */
  slots: AvailabilitySlot[];
}
