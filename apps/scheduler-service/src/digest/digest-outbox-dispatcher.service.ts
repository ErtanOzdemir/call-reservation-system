import { CALL_EVENTS_EXCHANGE, RoutingKey } from '@call-reservation/shared-types';
import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ChangeStream, ChangeStreamInsertDocument } from 'mongodb';
import { Model } from 'mongoose';
import { RabbitMqConnectionService } from '../shared-kernel/rabbitmq/rabbitmq-connection.service';
import {
  PendingDigestDocument,
  PendingDigestRecord,
} from './pending-digest.schema';

/**
 * Delivers digests queued in `pending-digests` (see DailyDigestService,
 * which only computes and enqueues — this is the only thing that actually
 * talks to RabbitMQ). Same shape as the other outbox dispatchers in this
 * service: catch up once at startup, then react to a live change stream —
 * no polling, and a RabbitMQ outage at 18:00 no longer loses the day's
 * digest outright, since it just sits here until delivered.
 *
 * Only "insert" is watched — these documents are only ever inserted then
 * deleted (never updated in place), and deletes aren't in the filter, so
 * clearing one after a successful publish doesn't re-trigger this handler.
 */
@Injectable()
export class DigestOutboxDispatcherService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(DigestOutboxDispatcherService.name);
  private changeStream?: ChangeStream<
    PendingDigestRecord,
    ChangeStreamInsertDocument<PendingDigestRecord>
  >;

  constructor(
    @InjectModel(PendingDigestRecord.name)
    private readonly pendingDigestModel: Model<PendingDigestDocument>,
    private readonly rabbitMq: RabbitMqConnectionService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.dispatchAlreadyPending();
    this.watchForNewDigests();
  }

  async onModuleDestroy(): Promise<void> {
    await this.changeStream?.close();
  }

  private async dispatchAlreadyPending(): Promise<void> {
    const pendingDigests = await this.pendingDigestModel.find().exec();

    for (const digest of pendingDigests) {
      // Isolated per document — one still-failing digest must not block
      // the rest of the catch-up sweep.
      await this.dispatchPendingDigest(digest).catch((error: unknown) =>
        this.logger.error(
          `Failed to dispatch the pending digest for ${digest.date}.`,
          error,
        ),
      );
    }
  }

  private watchForNewDigests(): void {
    this.changeStream = this.pendingDigestModel.watch<
      PendingDigestRecord,
      ChangeStreamInsertDocument<PendingDigestRecord>
    >([{ $match: { operationType: 'insert' } }], {
      fullDocument: 'updateLookup',
    });

    this.changeStream.on('change', (change) => {
      this.dispatchPendingDigest(change.fullDocument).catch(
        (error: unknown) =>
          this.logger.error('Failed to dispatch a queued digest.', error),
      );
    });

    this.changeStream.on('error', (error) =>
      this.logger.error('Digest outbox change stream error.', error),
    );
  }

  private async dispatchPendingDigest(
    digest: Pick<PendingDigestRecord, 'date' | 'eventId' | 'payload'>,
  ): Promise<void> {
    await this.rabbitMq.publish(CALL_EVENTS_EXCHANGE, RoutingKey.DigestDue, {
      ...digest.payload,
      eventId: digest.eventId,
    });

    // Publish first, delete after: on a crash or duplicate delivery in
    // between, the worst case is the digest going out twice, which is far
    // better than the pre-outbox failure mode of it silently never going
    // out at all.
    await this.pendingDigestModel.deleteOne({ date: digest.date }).exec();

    this.logger.log(`Dispatched digest.due for ${digest.date}.`);
  }
}
