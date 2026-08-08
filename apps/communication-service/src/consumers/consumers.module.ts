import { Module } from '@nestjs/common';
import { RabbitMqModule } from '../shared-kernel/rabbitmq/rabbitmq.module';
import { CallRequestedConsumer } from './call-requested.consumer';

@Module({
  imports: [RabbitMqModule],
  providers: [CallRequestedConsumer],
})
export class ConsumersModule {}
