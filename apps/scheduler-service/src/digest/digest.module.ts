import { Module } from '@nestjs/common';
import { RabbitMqModule } from '../shared-kernel/rabbitmq/rabbitmq.module';
import { StateModule } from '../state/state.module';
import { DailyDigestService } from './daily-digest.service';

@Module({
  imports: [RabbitMqModule, StateModule],
  providers: [DailyDigestService],
})
export class DigestModule {}
