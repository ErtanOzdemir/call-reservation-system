import { DateTime } from 'luxon';
import { InvalidAvailabilityDateError } from '../domain/errors/invalid-availability-date.error';
import { AvailabilityRepository } from '../infrastructure/mongo/availability.repository';
import { GetAvailabilityUseCase } from './get-availability.use-case';
import { GetAvailabilityUseCaseHandler } from './get-availability.use-case-handler';

function nextIstanbulWeekday(): DateTime {
  let day = DateTime.now().setZone('Europe/Istanbul').plus({ days: 1 });

  while (day.weekday > 5) {
    day = day.plus({ days: 1 });
  }

  return day.startOf('day');
}

describe('GetAvailabilityUseCaseHandler', () => {
  it('returns all sixteen slots when nothing is booked that day', async () => {
    const findOccupiedSlots = jest.fn().mockResolvedValue([]);
    const repository = {
      findOccupiedSlots,
    } as unknown as AvailabilityRepository;
    const handler = new GetAvailabilityUseCaseHandler(repository);
    const day = nextIstanbulWeekday();

    const result = await handler.execute(
      new GetAvailabilityUseCase(day.toISODate() as string),
    );

    expect(result.date).toBe(day.toISODate());
    expect(result.availableSlots).toHaveLength(16);
    expect(result.availableSlots[0]).toBe(
      day.set({ hour: 10, minute: 0 }).toISO(),
    );
  });

  it('excludes slots already held by a REQUESTED/SCHEDULED call', async () => {
    const day = nextIstanbulWeekday();
    const occupiedSlot = day.set({ hour: 11, minute: 0 }).toJSDate();
    const findOccupiedSlots = jest.fn().mockResolvedValue([occupiedSlot]);
    const repository = {
      findOccupiedSlots,
    } as unknown as AvailabilityRepository;
    const handler = new GetAvailabilityUseCaseHandler(repository);

    const result = await handler.execute(
      new GetAvailabilityUseCase(day.toISODate() as string),
    );

    expect(result.availableSlots).toHaveLength(15);
    expect(result.availableSlots).not.toContain(
      day.set({ hour: 11, minute: 0 }).toISO(),
    );
  });

  it('returns an empty list for a weekend without querying the repository', async () => {
    const findOccupiedSlots = jest.fn();
    const repository = {
      findOccupiedSlots,
    } as unknown as AvailabilityRepository;
    const handler = new GetAvailabilityUseCaseHandler(repository);

    let saturday = DateTime.now().setZone('Europe/Istanbul').plus({ days: 1 });
    while (saturday.weekday !== 6) {
      saturday = saturday.plus({ days: 1 });
    }

    const result = await handler.execute(
      new GetAvailabilityUseCase(saturday.toISODate() as string),
    );

    expect(result.availableSlots).toEqual([]);
    expect(findOccupiedSlots).not.toHaveBeenCalled();
  });

  it('throws for an unparseable date', async () => {
    const repository = {
      findOccupiedSlots: jest.fn(),
    } as unknown as AvailabilityRepository;
    const handler = new GetAvailabilityUseCaseHandler(repository);

    await expect(
      handler.execute(new GetAvailabilityUseCase('not-a-date')),
    ).rejects.toBeInstanceOf(InvalidAvailabilityDateError);
  });
});
