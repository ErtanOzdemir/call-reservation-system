export const AVAILABILITY_REPOSITORY = Symbol('AVAILABILITY_REPOSITORY');

export interface AvailabilityRepositoryPort {
  findOccupiedSlots(dayStart: Date, dayEnd: Date): Promise<Date[]>;
}
