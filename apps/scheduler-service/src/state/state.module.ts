import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { RabbitMqModule } from '../shared-kernel/rabbitmq/rabbitmq.module';
import { MongoScheduledCallRepository } from './mongo-scheduled-call-repository';
import { ReminderOutboxDispatcherService } from './reminder-outbox-dispatcher.service';
import { SCHEDULED_CALL_REPOSITORY } from './scheduled-call.repository';
import {
  ScheduledCallRecord,
  ScheduledCallSchema,
} from './scheduled-call.schema';

@Module({
  imports: [
    RabbitMqModule,
    MongooseModule.forFeature([
      { name: ScheduledCallRecord.name, schema: ScheduledCallSchema },
    ]),
  ],
  providers: [
    MongoScheduledCallRepository,
    {
      provide: SCHEDULED_CALL_REPOSITORY,
      useExisting: MongoScheduledCallRepository,
    },
    ReminderOutboxDispatcherService,
  ],
  exports: [SCHEDULED_CALL_REPOSITORY],
})
export class StateModule {}
