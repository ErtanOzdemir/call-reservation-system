import {
  CALL_EVENTS_EXCHANGE,
  CallStatus,
  ReminderDueEvent,
  RoutingKey,
} from '@call-reservation/shared-types';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ConsumeMessage } from 'amqplib';
import {
  RabbitMqConnectionService,
  REMINDER_DELAY_EXCHANGE,
  REMINDER_WAKEUP_ROUTING_KEY,
} from '../shared-kernel/rabbitmq/rabbitmq-connection.service';
import { ScheduledCallRepository } from '../state/scheduled-call.repository';

const REMINDER_WAKEUP_QUEUE = 'scheduler.reminder-wakeup';

interface WakeupPayload {
  requestId: string;
  eventId: string;
}

@Injectable()
export class ReminderWakeupConsumer implements OnModuleInit {
  private readonly logger = new Logger(ReminderWakeupConsumer.name);
  private readonly adminEmail: string;

  constructor(
    private readonly rabbitMq: RabbitMqConnectionService,
    private readonly scheduledCallRepository: ScheduledCallRepository,
    configService: ConfigService,
  ) {
    this.adminEmail = configService.getOrThrow<string>('reminder.adminEmail');
  }

  async onModuleInit(): Promise<void> {
    const channel = this.rabbitMq.channel;

    await channel.assertQueue(REMINDER_WAKEUP_QUEUE, { durable: true });
    await channel.bindQueue(
      REMINDER_WAKEUP_QUEUE,
      REMINDER_DELAY_EXCHANGE,
      REMINDER_WAKEUP_ROUTING_KEY,
    );

    // See CallEventsConsumer for why: one unacked message at a time, so
    // wakeups for the same requestId can't be processed out of order.
    await channel.prefetch(1);

    await channel.consume(REMINDER_WAKEUP_QUEUE, (message) => {
      if (!message) {
        return;
      }

      this.handleMessage(message).catch((error: unknown) => {
        this.logger.error('Failed to handle a reminder wakeup.', error);
        channel.nack(message, false, true);
      });
    });

    this.logger.log(
      `Listening for reminder wakeups on "${REMINDER_WAKEUP_QUEUE}".`,
    );
  }

  private async handleMessage(message: ConsumeMessage): Promise<void> {
    const { requestId, eventId } = JSON.parse(
      message.content.toString('utf8'),
    ) as WakeupPayload;

    const scheduledCall =
      await this.scheduledCallRepository.findByRequestId(requestId);

    if (scheduledCall?.status === CallStatus.SCHEDULED) {
      // Single-admin simplification: every reminder goes to the one address
      // in ADMIN_EMAIL. A multi-admin setup could broadcast call.requested
      // to every admin and then route reminders only to whichever admin
      // approved the request, but that pulls in request-to-admin ownership
      // that's out of scope for this assignment.
      const event: ReminderDueEvent = {
        requestId,
        customerEmail: scheduledCall.email,
        adminEmail: this.adminEmail,
        scheduledAt: scheduledCall.scheduledAt.toISOString(),
      };

      // Reuse the wakeup's eventId rather than minting a fresh one: if this
      // wakeup gets redelivered (broker-level at-least-once), handleMessage
      // runs again and republishes reminder.due — carrying the same eventId
      // both times lets Communication Service's inbox recognize the second
      // publish as a duplicate instead of a new event.
      await this.rabbitMq.publish(
        CALL_EVENTS_EXCHANGE,
        RoutingKey.ReminderDue,
        {
          ...event,
          eventId,
        },
      );

      this.logger.log(`Published reminder.due for call request ${requestId}.`);
    } else {
      this.logger.log(
        `Skipping reminder for call request ${requestId} — no longer scheduled.`,
      );
    }

    this.rabbitMq.channel.ack(message);
  }
}
