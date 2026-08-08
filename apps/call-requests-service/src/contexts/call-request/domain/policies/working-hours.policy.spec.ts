import { InvalidReservationTimeError } from '../errors/invalid-reservation-time.error';
import { WorkingHoursPolicy } from './working-hours.policy';

// 2026-08-03 is a Monday, 2026-08-04 a Tuesday, 2026-08-08/09 a Sat/Sun in Istanbul (UTC+3).
const NOW = new Date('2026-08-03T09:00:00+03:00');

describe('WorkingHoursPolicy', () => {
  it('accepts a future weekday slot within working hours', () => {
    expect(() =>
      WorkingHoursPolicy.assertBookable(
        new Date('2026-08-04T10:00:00+03:00'),
        NOW,
      ),
    ).not.toThrow();
  });

  it('accepts the last valid slot of the day (17:30, ending exactly at 18:00)', () => {
    expect(() =>
      WorkingHoursPolicy.assertBookable(
        new Date('2026-08-04T17:30:00+03:00'),
        NOW,
      ),
    ).not.toThrow();
  });

  it('rejects a slot before 10:00', () => {
    expect(() =>
      WorkingHoursPolicy.assertBookable(
        new Date('2026-08-04T09:30:00+03:00'),
        NOW,
      ),
    ).toThrow(InvalidReservationTimeError);
  });

  it('rejects a slot starting at or after 17:45 (would run past 18:00)', () => {
    expect(() =>
      WorkingHoursPolicy.assertBookable(
        new Date('2026-08-04T17:45:00+03:00'),
        NOW,
      ),
    ).toThrow(InvalidReservationTimeError);
  });

  it('rejects a slot not aligned to a 30-minute boundary', () => {
    expect(() =>
      WorkingHoursPolicy.assertBookable(
        new Date('2026-08-04T11:10:00+03:00'),
        NOW,
      ),
    ).toThrow(InvalidReservationTimeError);
  });

  it('rejects Saturday', () => {
    expect(() =>
      WorkingHoursPolicy.assertBookable(
        new Date('2026-08-08T11:00:00+03:00'),
        NOW,
      ),
    ).toThrow(InvalidReservationTimeError);
  });

  it('rejects Sunday', () => {
    expect(() =>
      WorkingHoursPolicy.assertBookable(
        new Date('2026-08-09T11:00:00+03:00'),
        NOW,
      ),
    ).toThrow(InvalidReservationTimeError);
  });

  it('rejects a same-day booking even if the clock time is later than now', () => {
    expect(() =>
      WorkingHoursPolicy.assertBookable(
        new Date('2026-08-03T14:00:00+03:00'),
        NOW,
      ),
    ).toThrow(InvalidReservationTimeError);
  });

  it('rejects a past date', () => {
    expect(() =>
      WorkingHoursPolicy.assertBookable(
        new Date('2026-08-02T14:00:00+03:00'),
        NOW,
      ),
    ).toThrow(InvalidReservationTimeError);
  });

  it('rejects an unparseable date', () => {
    expect(() =>
      WorkingHoursPolicy.assertBookable(new Date('not-a-date'), NOW),
    ).toThrow(InvalidReservationTimeError);
  });
});
