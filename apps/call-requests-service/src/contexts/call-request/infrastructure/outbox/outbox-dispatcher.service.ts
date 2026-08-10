import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import {
  ChangeStream,
  ChangeStreamInsertDocument,
  ChangeStreamUpdateDocument,
} from 'mongodb';
import { Model } from 'mongoose';
import { RabbitMqConnectionService } from '../../../../shared-kernel/rabbitmq/rabbitmq-connection.service';
import {
  CallRequestDocument,
  CallRequestRecord,
} from '../mongo/call-request.schema';

type CallRequestChange =
  | ChangeStreamInsertDocument<CallRequestRecord>
  | ChangeStreamUpdateDocument<CallRequestRecord>;

/**
 * Delivers events written to `pendingEvents` (see call-request.schema.ts) to
 * RabbitMQ, then clears them. Never polls: catches up on anything left
 * pending from before a restart once, then reacts to a live Mongo change
 * stream for everything after.
 */
@Injectable()
export class OutboxDispatcherService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OutboxDispatcherService.name);
  private changeStream?: ChangeStream<CallRequestRecord, CallRequestChange>;

  constructor(
    @InjectModel(CallRequestRecord.name)
    private readonly callRequestModel: Model<CallRequestDocument>,
    private readonly rabbitMq: RabbitMqConnectionService,
  ) {}

  async onModuleInit(): Promise<void> {
    this.watchForNewEvents();
    await this.dispatchAlreadyPending();
  }

  async onModuleDestroy(): Promise<void> {
    await this.changeStream?.close();
  }

  private async dispatchAlreadyPending(): Promise<void> {
    const requestsWithPendingEvents = await this.callRequestModel
      .find({ 'pendingEvents.0': { $exists: true } })
      .exec();

    for (const request of requestsWithPendingEvents) {
      await this.dispatchPendingEvents(request).catch((error: unknown) =>
        this.logger.error(
          `Failed to dispatch pending events for call request ${request.id}.`,
          error,
        ),
      );
    }
  }

  private watchForNewEvents(): void {
    this.changeStream = this.callRequestModel.watch<
      CallRequestRecord,
      CallRequestChange
    >([{ $match: { operationType: { $in: ['insert', 'update'] } } }], {
      fullDocument: 'updateLookup',
    });

    this.changeStream.on('change', (change) => {
      if (!change.fullDocument) {
        return;
      }

      this.dispatchPendingEvents(change.fullDocument).catch((error: unknown) =>
        this.logger.error('Failed to dispatch outbox events.', error),
      );
    });

    this.changeStream.on('error', (error) =>
      this.logger.error('Outbox change stream error.', error),
    );
  }

  private async dispatchPendingEvents(
    request: Pick<CallRequestRecord, 'id' | 'pendingEvents'>,
  ): Promise<void> {
    for (const event of request.pendingEvents) {
      await this.rabbitMq.publish(event.routingKey, {
        ...event.payload,
        eventId: event.eventId,
      });

      await this.callRequestModel
        .updateOne(
          { id: request.id },
          { $pull: { pendingEvents: { _id: event._id } } },
        )
        .exec();

      this.logger.log(
        `Dispatched "${event.routingKey}" for call request ${request.id}.`,
      );
    }
  }
}
