import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { RabbitMqModule } from '../../shared-kernel/rabbitmq/rabbitmq.module';
import { ApproveCallUseCase } from './application/approve-call.use-case';
import { CancelCallUseCase } from './application/cancel-call.use-case';
import { MarkCalledUseCase } from './application/mark-called.use-case';
import { RejectCallUseCase } from './application/reject-call.use-case';
import { ReserveCallUseCase } from './application/reserve-call.use-case';
import { CALL_REQUEST_REPOSITORY } from './domain/ports/call-request-repository.port';
import { AdminCallRequestsController } from './infrastructure/http/admin-call-requests.controller';
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
  controllers: [CallRequestsController, AdminCallRequestsController],
  providers: [
    ReserveCallUseCase,
    ApproveCallUseCase,
    RejectCallUseCase,
    CancelCallUseCase,
    MarkCalledUseCase,
    CallRequestRepositoryAdapter,
    OutboxDispatcherService,
    {
      provide: CALL_REQUEST_REPOSITORY,
      useExisting: CallRequestRepositoryAdapter,
    },
  ],
})
export class CallRequestModule {}
