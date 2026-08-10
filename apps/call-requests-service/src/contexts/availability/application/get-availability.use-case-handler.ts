import { Inject, Injectable } from '@nestjs/common';
import { DateTime } from 'luxon';
import {
  ISTANBUL_TIME_ZONE,
  WorkingHoursPolicy,
} from '../../call-request/domain/policies/working-hours.policy';
import { Availability } from '../domain/availability';
import { InvalidAvailabilityDateError } from '../domain/errors/invalid-availability-date.error';
import {
  AVAILABILITY_REPOSITORY,
  AvailabilityRepositoryPort,
} from '../domain/ports/availability-repository.port';
import { GetAvailabilityUseCase } from './useCase/get-availability.use-case';

@Injectable()
export class GetAvailabilityUseCaseHandler {
  constructor(
    @Inject(AVAILABILITY_REPOSITORY)
    private readonly availabilityRepository: AvailabilityRepositoryPort,
  ) {}

  async execute(useCase: GetAvailabilityUseCase): Promise<Availability> {
    const { date } = useCase;
    const dayStart = DateTime.fromISO(date, { zone: ISTANBUL_TIME_ZONE }).startOf('day');

    if (!dayStart.isValid) {
      throw new InvalidAvailabilityDateError(
        'date must be a valid calendar date in YYYY-MM-DD format.',
      );
    }

    const slots = WorkingHoursPolicy.enumerateSlotsForDay(dayStart, new Date());

    if (slots.length === 0) {
      return { date, slots: [] };
    }

    const occupied = await this.availabilityRepository.findOccupiedSlots(
      dayStart.toJSDate(),
      dayStart.plus({ days: 1 }).toJSDate(),
    );
    const occupiedTimestamps = new Set(occupied.map((slot) => slot.getTime()));

    return {
      date,
      slots: slots.map((slot) => ({
        time: slot.toISO() as string,
        available: !occupiedTimestamps.has(slot.toJSDate().getTime()),
      })),
    };
  }
}
