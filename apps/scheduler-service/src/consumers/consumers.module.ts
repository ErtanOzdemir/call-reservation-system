import { Module } from '@nestjs/common';
import { RabbitMqModule } from '../shared-kernel/rabbitmq/rabbitmq.module';
import { StateModule } from '../state/state.module';
import { CallEventsConsumer } from './call-events.consumer';
import { ReminderWakeupConsumer } from './reminder-wakeup.consumer';

@Module({
  imports: [RabbitMqModule, StateModule],
  providers: [CallEventsConsumer, ReminderWakeupConsumer],
})
export class ConsumersModule {}
