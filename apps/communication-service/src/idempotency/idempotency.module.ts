import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { MongoProcessedEventRepository } from './mongo-processed-event-repository';
import { PROCESSED_EVENT_REPOSITORY } from './processed-event.repository';
import {
  ProcessedEventRecord,
  ProcessedEventSchema,
} from './processed-event.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ProcessedEventRecord.name, schema: ProcessedEventSchema },
    ]),
  ],
  providers: [
    MongoProcessedEventRepository,
    {
      provide: PROCESSED_EVENT_REPOSITORY,
      useExisting: MongoProcessedEventRepository,
    },
  ],
  exports: [PROCESSED_EVENT_REPOSITORY],
})
export class IdempotencyModule {}
