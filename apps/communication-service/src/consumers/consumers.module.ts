import { Module } from '@nestjs/common';
import { RabbitMqModule } from '../shared-kernel/rabbitmq/rabbitmq.module';
import { CallEventsConsumer } from './call-events.consumer';

@Module({
  imports: [RabbitMqModule],
  providers: [CallEventsConsumer],
})
export class ConsumersModule {}
