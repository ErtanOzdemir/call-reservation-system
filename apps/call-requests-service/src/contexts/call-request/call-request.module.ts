import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { RabbitMqModule } from '../../shared-kernel/rabbitmq/rabbitmq.module';
import { ReserveCallUseCase } from './application/reserve-call.use-case';
import { CALL_REQUEST_REPOSITORY } from './domain/ports/call-request-repository.port';
import { CallRequestsController } from './infrastructure/http/call-requests.controller';
import { CallRequestRepositoryAdapter } from './infrastructure/mongo/call-request-repository.adapter';
import {
  CallRequestRecord,
  CallRequestSchema,
} from './infrastructure/mongo/call-request.schema';
import { OutboxDispatcherService } from './infrastructure/outbox/outbox-dispatcher.service';

@Module({
  imports: [
    RabbitMqModule,
    MongooseModule.forFeature([
      { name: CallRequestRecord.name, schema: CallRequestSchema },
    ]),
  ],
  controllers: [CallRequestsController],
  providers: [
    ReserveCallUseCase,
    CallRequestRepositoryAdapter,
    OutboxDispatcherService,
    {
      provide: CALL_REQUEST_REPOSITORY,
      useExisting: CallRequestRepositoryAdapter,
    },
  ],
})
export class CallRequestModule {}
