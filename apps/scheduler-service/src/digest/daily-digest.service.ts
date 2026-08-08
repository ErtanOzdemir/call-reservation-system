import {
  CALL_EVENTS_EXCHANGE,
  DigestDueEvent,
  RoutingKey,
} from '@call-reservation/shared-types';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { DateTime } from 'luxon';
import { RabbitMqConnectionService } from '../shared-kernel/rabbitmq/rabbitmq-connection.service';
import { ScheduledCallRepository } from '../state/scheduled-call.repository';

const ISTANBUL_TIME_ZONE = 'Europe/Istanbul';

/**
 * The system's only cron job (see project constraint: only scheduler-service
 * runs cron/intervals). Fires once a day and publishes a single digest.due
 * with tomorrow's SCHEDULED calls, read from this service's own local state
 * — never queries call-requests-service.
 */
@Injectable()
export class DailyDigestService {
  private readonly logger = new Logger(DailyDigestService.name);
  private readonly adminEmail: string;

  constructor(
    private readonly scheduledCallRepository: ScheduledCallRepository,
    private readonly rabbitMq: RabbitMqConnectionService,
    configService: ConfigService,
  ) {
    this.adminEmail = configService.getOrThrow<string>('reminder.adminEmail');
  }

  @Cron('0 18 * * *', { timeZone: ISTANBUL_TIME_ZONE })
  async publishDailyDigest(): Promise<void> {
    const tomorrowStart = DateTime.now()
      .setZone(ISTANBUL_TIME_ZONE)
      .plus({ days: 1 })
      .startOf('day');
    const tomorrowEnd = tomorrowStart.plus({ days: 1 });

    const calls = await this.scheduledCallRepository.findScheduledBetween(
      tomorrowStart.toJSDate(),
      tomorrowEnd.toJSDate(),
    );

    const event: DigestDueEvent = {
      adminEmail: this.adminEmail,
      date: tomorrowStart.toISODate() as string,
      calls: calls.map((call) => ({
        requestId: call.requestId,
        email: call.email,
        scheduledAt: call.scheduledAt.toISOString(),
      })),
    };

    this.rabbitMq.channel.publish(
      CALL_EVENTS_EXCHANGE,
      RoutingKey.DigestDue,
      Buffer.from(JSON.stringify(event)),
      { contentType: 'application/json', persistent: true },
    );

    this.logger.log(
      `Published digest.due for ${event.date} with ${event.calls.length} call(s).`,
    );
  }
}
