export interface DigestDueCallSummary {
  requestId: string;
  email: string;
  /** ISO 8601 timestamp with an explicit UTC offset. */
  scheduledAt: string;
}

export interface DigestDueEvent {
  adminEmail: string;
  /** The Istanbul-local calendar day these calls are scheduled for, e.g. "2026-08-10". */
  date: string;
  calls: DigestDueCallSummary[];
}
