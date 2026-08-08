import { Module } from '@nestjs/common';
import { RabbitMqModule } from '../shared-kernel/rabbitmq/rabbitmq.module';
import { StateModule } from '../state/state.module';
import { CallRequestedConsumer } from './call-requested.consumer';

@Module({
  imports: [RabbitMqModule, StateModule],
  providers: [CallRequestedConsumer],
})
export class ConsumersModule {}
