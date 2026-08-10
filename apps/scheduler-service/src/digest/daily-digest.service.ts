import { DigestDueEvent } from '@call-reservation/shared-types';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { DateTime } from 'luxon';
import { randomUUID } from 'node:crypto';
import {
  SCHEDULED_CALL_REPOSITORY,
  ScheduledCallRepository,
} from '../state/scheduled-call.repository';
import {
  PENDING_DIGEST_REPOSITORY,
  PendingDigestRepository,
} from './pending-digest.repository';

const ISTANBUL_TIME_ZONE = 'Europe/Istanbul';

/**
 * The system's only cron job (see project constraint: only scheduler-service
 * runs cron/intervals). Only computes tomorrow's digest and queues it —
 * DigestOutboxDispatcherService is the only thing that actually talks to
 * RabbitMQ, so a broker outage right at 18:00 no longer loses the digest.
 */
@Injectable()
export class DailyDigestService {
  private readonly logger = new Logger(DailyDigestService.name);

  constructor(
    @Inject(SCHEDULED_CALL_REPOSITORY)
    private readonly scheduledCallRepository: ScheduledCallRepository,
    @Inject(PENDING_DIGEST_REPOSITORY)
    private readonly pendingDigestRepository: PendingDigestRepository,
  ) {}

  @Cron('0 18 * * *', { timeZone: ISTANBUL_TIME_ZONE })
  async queueDailyDigest(): Promise<void> {
    const tomorrowStart = DateTime.now()
      .setZone(ISTANBUL_TIME_ZONE)
      .plus({ days: 1 })
      .startOf('day');
    const tomorrowEnd = tomorrowStart.plus({ days: 1 });

    const adminEmail = await this.scheduledCallRepository.findMostRecentAdminEmail();

    if (!adminEmail) {
      this.logger.warn(
        'Skipping digest.due — no admin has approved or canceled a call yet.',
      );
      return;
    }

    const calls = await this.scheduledCallRepository.findScheduledBetween(
      tomorrowStart.toJSDate(),
      tomorrowEnd.toJSDate(),
    );

    const event: DigestDueEvent = {
      adminEmail,
      date: tomorrowStart.toISODate() as string,
      calls: calls.map((call) => ({
        requestId: call.requestId,
        email: call.email,
        scheduledAt: call.scheduledAt.toISOString(),
      })),
    };

    try {
      const queued = await this.pendingDigestRepository.queue({
        date: event.date,
        eventId: randomUUID(),
        payload: { ...event },
      });

      if (!queued) {
        this.logger.warn(`Digest for ${event.date} was already queued.`);
        return;
      }

      this.logger.log(
        `Queued digest.due for ${event.date} with ${event.calls.length} call(s).`,
      );
    } catch (error) {
      this.logger.error(`Failed to queue digest.due for ${event.date}.`, error);
    }
  }
}
