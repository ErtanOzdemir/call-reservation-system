import { Module } from '@nestjs/common';
import { IdempotencyModule } from '../idempotency/idempotency.module';
import { EmailModule } from '../shared-kernel/email/email.module';
import { RabbitMqModule } from '../shared-kernel/rabbitmq/rabbitmq.module';
import { CallEventsConsumer } from './call-events.consumer';

@Module({
  imports: [RabbitMqModule, EmailModule, IdempotencyModule],
  providers: [CallEventsConsumer],
})
export class ConsumersModule {}
