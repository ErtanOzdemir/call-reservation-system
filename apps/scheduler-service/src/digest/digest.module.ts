import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { RabbitMqModule } from '../shared-kernel/rabbitmq/rabbitmq.module';
import { StateModule } from '../state/state.module';
import { DailyDigestService } from './daily-digest.service';
import { DigestOutboxDispatcherService } from './digest-outbox-dispatcher.service';
import { PendingDigestRepository } from './pending-digest.repository';
import {
  PendingDigestRecord,
  PendingDigestSchema,
} from './pending-digest.schema';

@Module({
  imports: [
    RabbitMqModule,
    StateModule,
    MongooseModule.forFeature([
      { name: PendingDigestRecord.name, schema: PendingDigestSchema },
    ]),
  ],
  providers: [
    DailyDigestService,
    DigestOutboxDispatcherService,
    PendingDigestRepository,
  ],
})
export class DigestModule {}
