import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  CallRequestRecord,
  CallRequestSchema,
} from '../call-request/infrastructure/mongo/call-request.schema';
import { GetAvailabilityUseCaseHandler } from './application/get-availability.use-case-handler';
import { AVAILABILITY_REPOSITORY } from './domain/ports/availability-repository.port';
import { AvailabilityController } from './infrastructure/http/availability.controller';
import { MongoAvailabilityRepositoryAdapter } from './infrastructure/mongo/mongo-availability-repository.adapter';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: CallRequestRecord.name, schema: CallRequestSchema },
    ]),
  ],
  controllers: [AvailabilityController],
  providers: [
    GetAvailabilityUseCaseHandler,
    MongoAvailabilityRepositoryAdapter,
    {
      provide: AVAILABILITY_REPOSITORY,
      useExisting: MongoAvailabilityRepositoryAdapter,
    },
  ],
})
export class AvailabilityModule {}
