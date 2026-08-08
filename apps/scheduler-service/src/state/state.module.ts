import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { RabbitMqModule } from '../shared-kernel/rabbitmq/rabbitmq.module';
import { ReminderOutboxDispatcherService } from './reminder-outbox-dispatcher.service';
import { ScheduledCallRepository } from './scheduled-call.repository';
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
  providers: [ScheduledCallRepository, ReminderOutboxDispatcherService],
  exports: [ScheduledCallRepository],
})
export class StateModule {}
