import { Module } from '@nestjs/common';
import { RabbitMqConnectionService } from './rabbitmq-connection.service';

@Module({
  providers: [RabbitMqConnectionService],
  exports: [RabbitMqConnectionService],
})
export class RabbitMqModule {}
