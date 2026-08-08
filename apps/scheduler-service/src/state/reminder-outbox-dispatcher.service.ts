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
 * Delivers the reminder wakeup written to `pendingReminder` (see
 * scheduled-call.schema.ts) to RabbitMQ's delayed exchange, recomputing the
 * remaining delay from its absolute targetFireAt rather than trusting a
 * pre-computed one — this dispatcher may run the catch-up sweep well after
 * the reminder was originally queued. Same shape as call-requests-service's
 * OutboxDispatcherService: catch up once at startup, then react to a live
 * change stream — no polling.
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
      .find({ pendingReminder: { $exists: true } })
      .exec();

    for (const request of requestsWithPendingReminders) {
      // Isolated per document — one still-failing request must not block
      // the rest of the catch-up sweep.
      await this.dispatchPendingReminder(request).catch((error: unknown) =>
        this.logger.error(
          `Failed to dispatch the pending reminder for call request ${request.requestId}.`,
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

      this.dispatchPendingReminder(change.fullDocument).catch(
        (error: unknown) =>
          this.logger.error('Failed to dispatch an outbox reminder.', error),
      );
    });

    this.changeStream.on('error', (error) =>
      this.logger.error('Reminder outbox change stream error.', error),
    );
  }

  private async dispatchPendingReminder(
    request: Pick<ScheduledCallRecord, 'requestId' | 'pendingReminder'>,
  ): Promise<void> {
    const reminder = request.pendingReminder;

    if (!reminder) {
      return;
    }

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

    // Only clear the reminder we just dispatched — matching on
    // targetFireAt guards against clobbering a newer one that could in
    // theory have replaced it between the read above and this write.
    await this.scheduledCallModel
      .updateOne(
        {
          requestId: request.requestId,
          'pendingReminder.targetFireAt': reminder.targetFireAt,
        },
        { $unset: { pendingReminder: '' } },
      )
      .exec();

    this.logger.log(
      `Dispatched reminder wakeup for ${reminder.requestId} (delay ${delayMs}ms).`,
    );
  }
}
