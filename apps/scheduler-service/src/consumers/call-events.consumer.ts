import {
  CALL_EVENTS_EXCHANGE,
  CallApprovedEvent,
  CallCanceledEvent,
  CallStatus,
  RoutingKey,
} from '@call-reservation/shared-types';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConsumeMessage } from 'amqplib';
import { randomUUID } from 'node:crypto';
import { RabbitMqConnectionService } from '../shared-kernel/rabbitmq/rabbitmq-connection.service';
import { ScheduledCallRepository } from '../state/scheduled-call.repository';

const SCHEDULER_QUEUE = 'scheduler.call-events';
const BOUND_ROUTING_KEYS = [RoutingKey.CallApproved, RoutingKey.CallCanceled];
const REMINDER_LEAD_TIME_MS = 2 * 60 * 60 * 1000;

@Injectable()
export class CallEventsConsumer implements OnModuleInit {
  private readonly logger = new Logger(CallEventsConsumer.name);

  constructor(
    private readonly rabbitMq: RabbitMqConnectionService,
    private readonly scheduledCallRepository: ScheduledCallRepository,
  ) {}

  async onModuleInit(): Promise<void> {
    const channel = this.rabbitMq.channel;

    await channel.assertQueue(SCHEDULER_QUEUE, { durable: true });

    for (const routingKey of BOUND_ROUTING_KEYS) {
      await channel.bindQueue(
        SCHEDULER_QUEUE,
        CALL_EVENTS_EXCHANGE,
        routingKey,
      );
    }

    // One unacked message at a time: without this, RabbitMQ can hand us a
    // second message for the same requestId before the first one's write
    // has finished, and whichever write lands last wins regardless of
    // delivery order.
    await channel.prefetch(1);

    await channel.consume(SCHEDULER_QUEUE, (message) => {
      if (!message) {
        return;
      }

      this.handleMessage(message).catch((error: unknown) => {
        this.logger.error(
          `Failed to handle "${message.fields.routingKey}" message.`,
          error,
        );
        channel.nack(message, false, true);
      });
    });

    this.logger.log(
      `Listening for [${BOUND_ROUTING_KEYS.join(', ')}] on "${SCHEDULER_QUEUE}".`,
    );
  }

  private async handleMessage(message: ConsumeMessage): Promise<void> {
    switch (message.fields.routingKey) {
      case RoutingKey.CallApproved:
        await this.handleCallApproved(message);
        break;
      case RoutingKey.CallCanceled:
        await this.handleCallCanceled(message);
        break;
      default:
        this.logger.warn(
          `No handler for routing key "${message.fields.routingKey}"; dropping it.`,
        );
    }

    this.rabbitMq.channel.ack(message);
  }

  private async handleCallApproved(message: ConsumeMessage): Promise<void> {
    const event = JSON.parse(
      message.content.toString('utf8'),
    ) as CallApprovedEvent;

    const scheduledAt = new Date(event.scheduledAt);
    const targetFireAt = new Date(
      scheduledAt.getTime() - REMINDER_LEAD_TIME_MS,
    );

    await this.scheduledCallRepository.upsert(
      {
        requestId: event.requestId,
        email: event.email,
        scheduledAt,
        status: CallStatus.SCHEDULED,
      },
      { scheduleReminderAt: targetFireAt, eventId: randomUUID() },
    );

    this.logger.log(`Marked call request ${event.requestId} as scheduled.`);
  }

  private async handleCallCanceled(message: ConsumeMessage): Promise<void> {
    const event = JSON.parse(
      message.content.toString('utf8'),
    ) as CallCanceledEvent;

    await this.scheduledCallRepository.cancel(event.requestId);

    this.logger.log(`Marked call request ${event.requestId} as canceled.`);
  }
}
