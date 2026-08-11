import { Module } from '@nestjs/common';
import { IdempotencyModule } from '../idempotency/idempotency.module';
import { RabbitMqModule } from '../shared-kernel/rabbitmq/rabbitmq.module';
import { StateModule } from '../state/state.module';
import { CallEventsConsumer } from './call-events.consumer';
import { ReminderWakeupConsumer } from './reminder-wakeup.consumer';

@Module({
  imports: [RabbitMqModule, StateModule, IdempotencyModule],
  providers: [CallEventsConsumer, ReminderWakeupConsumer],
})
export class ConsumersModule {}
