import { DateTime } from 'luxon';
import { InvalidReservationTimeError } from '../errors/invalid-reservation-time.error';

export const ISTANBUL_TIME_ZONE = 'Europe/Istanbul';
const WORKING_START_MINUTES = 10 * 60; // 10:00
const WORKING_END_MINUTES = 18 * 60; // 18:00
const CALL_DURATION_MINUTES = 30;
const LAST_ISO_WEEKDAY_FOR_WORK = 5; // Luxon: 1 = Monday .. 7 = Sunday

/**
 * Enforces the booking window (10:00–18:00 Istanbul time, Monday–Friday,
 * 30-minute slots, future dates only) against the instant a timestamp
 * represents — never against the server process's own time zone.
 */
export class WorkingHoursPolicy {
  static assertBookable(scheduledAt: Date, now: Date): void {
    const zonedScheduledAt = DateTime.fromJSDate(scheduledAt, {
      zone: ISTANBUL_TIME_ZONE,
    });

    if (!zonedScheduledAt.isValid) {
      throw new InvalidReservationTimeError(
        'The scheduled time is not a valid date.',
      );
    }

    const zonedNow = DateTime.fromJSDate(now, { zone: ISTANBUL_TIME_ZONE });

    if (!this.isFutureDate(zonedScheduledAt, zonedNow)) {
      throw new InvalidReservationTimeError(
        'Calls can only be booked for a future date; past dates and same-day bookings are not allowed.',
      );
    }

    if (!this.isAlignedToSlot(zonedScheduledAt)) {
      throw new InvalidReservationTimeError(
        'Calls must start on a 30-minute slot boundary (e.g. 10:00, 10:30).',
      );
    }

    if (!this.isWithinWorkingWindow(zonedScheduledAt)) {
      throw new InvalidReservationTimeError(
        'Calls must be scheduled between 10:00 and 18:00 Istanbul time, Monday through Friday.',
      );
    }
  }

  /**
   * All bookable 30-minute slot start times for one Istanbul-local day — []
   * for weekends and for any day that isn't strictly in the future, per the
   * same rules `assertBookable` enforces for a single slot.
   */
  static enumerateSlotsForDay(dayStart: DateTime, now: Date): DateTime[] {
    const zonedNow = DateTime.fromJSDate(now, { zone: ISTANBUL_TIME_ZONE });

    if (
      !this.isFutureDate(dayStart, zonedNow) ||
      dayStart.weekday > LAST_ISO_WEEKDAY_FOR_WORK
    ) {
      return [];
    }

    const slots: DateTime[] = [];

    for (
      let minutes = WORKING_START_MINUTES;
      minutes + CALL_DURATION_MINUTES <= WORKING_END_MINUTES;
      minutes += CALL_DURATION_MINUTES
    ) {
      slots.push(dayStart.plus({ minutes }));
    }

    return slots;
  }

  private static isFutureDate(scheduledAt: DateTime, now: DateTime): boolean {
    return scheduledAt.startOf('day') > now.startOf('day');
  }

  private static isAlignedToSlot(scheduledAt: DateTime): boolean {
    return scheduledAt.minute === 0 || scheduledAt.minute === 30;
  }

  private static isWithinWorkingWindow(scheduledAt: DateTime): boolean {
    const isWeekday = scheduledAt.weekday <= LAST_ISO_WEEKDAY_FOR_WORK;
    const minutesOfDay = scheduledAt.hour * 60 + scheduledAt.minute;

    return (
      isWeekday &&
      minutesOfDay >= WORKING_START_MINUTES &&
      minutesOfDay + CALL_DURATION_MINUTES <= WORKING_END_MINUTES
    );
  }
}
