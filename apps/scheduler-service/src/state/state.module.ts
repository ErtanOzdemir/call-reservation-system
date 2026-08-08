import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ScheduledCallRepository } from './scheduled-call.repository';
import {
  ScheduledCallRecord,
  ScheduledCallSchema,
} from './scheduled-call.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ScheduledCallRecord.name, schema: ScheduledCallSchema },
    ]),
  ],
  providers: [ScheduledCallRepository],
  exports: [ScheduledCallRepository],
})
export class StateModule {}
