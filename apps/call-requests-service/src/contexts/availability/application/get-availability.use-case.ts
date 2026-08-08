import { AvailabilityDto } from '@call-reservation/shared-types';
import { Injectable } from '@nestjs/common';
import { DateTime } from 'luxon';
import {
  ISTANBUL_TIME_ZONE,
  WorkingHoursPolicy,
} from '../../call-request/domain/policies/working-hours.policy';
import { InvalidAvailabilityDateError } from '../domain/errors/invalid-availability-date.error';
import { AvailabilityRepository } from '../infrastructure/mongo/availability.repository';

@Injectable()
export class GetAvailabilityUseCase {
  constructor(private readonly availabilityRepository: AvailabilityRepository) {}

  async execute(date: string): Promise<AvailabilityDto> {
    const dayStart = DateTime.fromISO(date, { zone: ISTANBUL_TIME_ZONE }).startOf('day');

    if (!dayStart.isValid) {
      throw new InvalidAvailabilityDateError(
        'date must be a valid calendar date in YYYY-MM-DD format.',
      );
    }

    const slots = WorkingHoursPolicy.enumerateSlotsForDay(dayStart, new Date());

    if (slots.length === 0) {
      return { date, availableSlots: [] };
    }

    const occupied = await this.availabilityRepository.findOccupiedSlots(
      dayStart.toJSDate(),
      dayStart.plus({ days: 1 }).toJSDate(),
    );
    const occupiedTimestamps = new Set(occupied.map((slot) => slot.getTime()));

    return {
      date,
      availableSlots: slots
        .filter((slot) => !occupiedTimestamps.has(slot.toJSDate().getTime()))
        .map((slot) => slot.toISO() as string),
    };
  }
}
