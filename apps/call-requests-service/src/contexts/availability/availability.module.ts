import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  CallRequestRecord,
  CallRequestSchema,
} from '../call-request/infrastructure/mongo/call-request.schema';
import { GetAvailabilityUseCase } from './application/get-availability.use-case';
import { AvailabilityController } from './infrastructure/http/availability.controller';
import { AvailabilityRepository } from './infrastructure/mongo/availability.repository';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: CallRequestRecord.name, schema: CallRequestSchema },
    ]),
  ],
  controllers: [AvailabilityController],
  providers: [GetAvailabilityUseCase, AvailabilityRepository],
})
export class AvailabilityModule {}
