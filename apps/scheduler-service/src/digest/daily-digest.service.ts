import { DigestDueEvent } from '@call-reservation/shared-types';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Cron } from '@nestjs/schedule';
import { DateTime } from 'luxon';
import { Model } from 'mongoose';
import { ScheduledCallRepository } from '../state/scheduled-call.repository';
import { PendingDigestDocument, PendingDigestRecord } from './pending-digest.schema';

const ISTANBUL_TIME_ZONE = 'Europe/Istanbul';

const MONGO_DUPLICATE_KEY_ERROR_CODE = 11000;

function isDuplicateKeyError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code: unknown }).code === MONGO_DUPLICATE_KEY_ERROR_CODE
  );
}

/**
 * The system's only cron job (see project constraint: only scheduler-service
 * runs cron/intervals). Only computes tomorrow's digest and queues it —
 * DigestOutboxDispatcherService is the only thing that actually talks to
 * RabbitMQ, so a broker outage right at 18:00 no longer loses the digest.
 */
@Injectable()
export class DailyDigestService {
  private readonly logger = new Logger(DailyDigestService.name);
  private readonly adminEmail: string;

  constructor(
    private readonly scheduledCallRepository: ScheduledCallRepository,
    @InjectModel(PendingDigestRecord.name)
    private readonly pendingDigestModel: Model<PendingDigestDocument>,
    configService: ConfigService,
  ) {
    this.adminEmail = configService.getOrThrow<string>('reminder.adminEmail');
  }

  @Cron('0 18 * * *', { timeZone: ISTANBUL_TIME_ZONE })
  async queueDailyDigest(): Promise<void> {
    const tomorrowStart = DateTime.now()
      .setZone(ISTANBUL_TIME_ZONE)
      .plus({ days: 1 })
      .startOf('day');
    const tomorrowEnd = tomorrowStart.plus({ days: 1 });

    const calls = await this.scheduledCallRepository.findScheduledBetween(
      tomorrowStart.toJSDate(),
      tomorrowEnd.toJSDate(),
    );

    // Single-admin simplification: the digest always goes to ADMIN_EMAIL.
    // See the same note in reminder-wakeup.consumer.ts — a multi-admin
    // design (each request owned by whichever admin approved it) was kept
    // out of scope here.
    const event: DigestDueEvent = {
      adminEmail: this.adminEmail,
      date: tomorrowStart.toISODate() as string,
      calls: calls.map((call) => ({
        requestId: call.requestId,
        email: call.email,
        scheduledAt: call.scheduledAt.toISOString(),
      })),
    };

    try {
      await this.pendingDigestModel.create({
        date: event.date,
        payload: { ...event },
      });
      this.logger.log(
        `Queued digest.due for ${event.date} with ${event.calls.length} call(s).`,
      );
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        this.logger.warn(`Digest for ${event.date} was already queued.`);
        return;
      }

      this.logger.error(`Failed to queue digest.due for ${event.date}.`, error);
    }
  }
}
