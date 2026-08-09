import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ProcessedEventRepository } from './processed-event.repository';
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
  providers: [ProcessedEventRepository],
  exports: [ProcessedEventRepository],
})
export class IdempotencyModule {}
