import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { RabbitMqModule } from '../../shared-kernel/rabbitmq/rabbitmq.module';
import { ApproveCallUseCaseHandler } from './application/approve-call.use-case-handler';
import { CancelCallUseCaseHandler } from './application/cancel-call.use-case-handler';
import { ListCallRequestsUseCaseHandler } from './application/list-call-requests.use-case-handler';
import { ListMyCallRequestsUseCaseHandler } from './application/list-my-call-requests.use-case-handler';
import { MarkCalledUseCaseHandler } from './application/mark-called.use-case-handler';
import { RejectCallUseCaseHandler } from './application/reject-call.use-case-handler';
import { ReserveCallUseCaseHandler } from './application/reserve-call.use-case-handler';
import { SetCallRequestNotesUseCaseHandler } from './application/set-call-request-notes.use-case-handler';
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
    ReserveCallUseCaseHandler,
    ApproveCallUseCaseHandler,
    RejectCallUseCaseHandler,
    CancelCallUseCaseHandler,
    MarkCalledUseCaseHandler,
    SetCallRequestNotesUseCaseHandler,
    ListCallRequestsUseCaseHandler,
    ListMyCallRequestsUseCaseHandler,
    CallRequestRepositoryAdapter,
    OutboxDispatcherService,
    {
      provide: CALL_REQUEST_REPOSITORY,
      useExisting: CallRequestRepositoryAdapter,
    },
  ],
})
export class CallRequestModule {}
