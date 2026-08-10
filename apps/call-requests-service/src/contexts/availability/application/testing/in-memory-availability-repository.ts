import { AvailabilityRepositoryPort } from '../../domain/ports/availability-repository.port';

export class InMemoryAvailabilityRepository implements AvailabilityRepositoryPort {
  occupiedSlots: Date[] = [];
  calls: Array<{ dayStart: Date; dayEnd: Date }> = [];

  async findOccupiedSlots(dayStart: Date, dayEnd: Date): Promise<Date[]> {
    this.calls.push({ dayStart, dayEnd });
    return this.occupiedSlots;
  }
}
