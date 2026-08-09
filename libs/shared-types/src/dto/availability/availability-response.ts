export interface AvailabilityResponse {
  /** The Istanbul-local calendar day this availability was computed for, e.g. "2026-08-10". */
  date: string;
  /** ISO 8601 timestamps (with UTC offset) of bookable 30-minute slot starts. */
  availableSlots: string[];
}
