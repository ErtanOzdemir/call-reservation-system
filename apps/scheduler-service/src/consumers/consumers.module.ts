import { Module } from '@nestjs/common';
import { RabbitMqModule } from '../shared-kernel/rabbitmq/rabbitmq.module';
import { StateModule } from '../state/state.module';
import { CallEventsConsumer } from './call-events.consumer';

@Module({
  imports: [RabbitMqModule, StateModule],
  providers: [CallEventsConsumer],
})
export class ConsumersModule {}
