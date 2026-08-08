import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import {
  ChangeStream,
  ChangeStreamInsertDocument,
  ChangeStreamUpdateDocument,
} from 'mongodb';
import { Model } from 'mongoose';
import {
  RabbitMqConnectionService,
  REMINDER_DELAY_EXCHANGE,
  REMINDER_WAKEUP_ROUTING_KEY,
} from '../shared-kernel/rabbitmq/rabbitmq-connection.service';
import {
  ScheduledCallDocument,
  ScheduledCallRecord,
} from './scheduled-call.schema';

type ScheduledCallChange =
  | ChangeStreamInsertDocument<ScheduledCallRecord>
  | ChangeStreamUpdateDocument<ScheduledCallRecord>;

/**
 * Delivers reminder wakeups written to `pendingReminders` (see
 * scheduled-call.schema.ts) to RabbitMQ's delayed exchange, recomputing the
 * remaining delay from each reminder's absolute targetFireAt rather than
 * trusting a pre-computed one — this dispatcher may run the catch-up sweep
 * well after the reminder was originally queued. Same shape as
 * call-requests-service's OutboxDispatcherService: catch up once at
 * startup, then react to a live change stream — no polling.
 */
@Injectable()
export class ReminderOutboxDispatcherService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(ReminderOutboxDispatcherService.name);
  private changeStream?: ChangeStream<ScheduledCallRecord, ScheduledCallChange>;

  constructor(
    @InjectModel(ScheduledCallRecord.name)
    private readonly scheduledCallModel: Model<ScheduledCallDocument>,
    private readonly rabbitMq: RabbitMqConnectionService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.dispatchAlreadyPending();
    this.watchForNewReminders();
  }

  async onModuleDestroy(): Promise<void> {
    await this.changeStream?.close();
  }

  private async dispatchAlreadyPending(): Promise<void> {
    const requestsWithPendingReminders = await this.scheduledCallModel
      .find({ 'pendingReminders.0': { $exists: true } })
      .exec();

    for (const request of requestsWithPendingReminders) {
      // Isolated per document — one still-failing request must not block
      // the rest of the catch-up sweep.
      await this.dispatchPendingReminders(request).catch((error: unknown) =>
        this.logger.error(
          `Failed to dispatch pending reminders for call request ${request.requestId}.`,
          error,
        ),
      );
    }
  }

  private watchForNewReminders(): void {
    this.changeStream = this.scheduledCallModel.watch<
      ScheduledCallRecord,
      ScheduledCallChange
    >([{ $match: { operationType: { $in: ['insert', 'update'] } } }], {
      fullDocument: 'updateLookup',
    });

    this.changeStream.on('change', (change) => {
      if (!change.fullDocument) {
        return;
      }

      this.dispatchPendingReminders(change.fullDocument).catch(
        (error: unknown) =>
          this.logger.error('Failed to dispatch outbox reminders.', error),
      );
    });

    this.changeStream.on('error', (error) =>
      this.logger.error('Reminder outbox change stream error.', error),
    );
  }

  private async dispatchPendingReminders(
    request: Pick<ScheduledCallRecord, 'requestId' | 'pendingReminders'>,
  ): Promise<void> {
    for (const reminder of request.pendingReminders) {
      const delayMs = Math.max(
        0,
        new Date(reminder.targetFireAt).getTime() - Date.now(),
      );

      this.rabbitMq.channel.publish(
        REMINDER_DELAY_EXCHANGE,
        REMINDER_WAKEUP_ROUTING_KEY,
        Buffer.from(JSON.stringify({ requestId: reminder.requestId })),
        { headers: { 'x-delay': delayMs }, persistent: true },
      );

      await this.scheduledCallModel
        .updateOne(
          { requestId: request.requestId },
          { $pull: { pendingReminders: { _id: reminder._id } } },
        )
        .exec();

      this.logger.log(
        `Dispatched reminder wakeup for ${reminder.requestId} (delay ${delayMs}ms).`,
      );
    }
  }
}
