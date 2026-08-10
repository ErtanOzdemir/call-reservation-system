import { Model } from 'mongoose';
import { CallRequestDocument } from '../../../call-request/infrastructure/mongo/call-request.schema';
import { AvailabilityRepository } from '../../infrastructure/mongo/availability.repository';

export class InMemoryAvailabilityRepository extends AvailabilityRepository {
  occupiedSlots: Date[] = [];
  calls: Array<{ dayStart: Date; dayEnd: Date }> = [];

  constructor() {
    super(null as unknown as Model<CallRequestDocument>);
  }

  async findOccupiedSlots(dayStart: Date, dayEnd: Date): Promise<Date[]> {
    this.calls.push({ dayStart, dayEnd });
    return this.occupiedSlots;
  }
}
