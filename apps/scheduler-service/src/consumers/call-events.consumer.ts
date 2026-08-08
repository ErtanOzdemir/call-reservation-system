import {
  CALL_EVENTS_EXCHANGE,
  CallApprovedEvent,
  CallRequestedEvent,
  CallStatus,
  RoutingKey,
} from '@call-reservation/shared-types';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConsumeMessage } from 'amqplib';
import { RabbitMqConnectionService } from '../shared-kernel/rabbitmq/rabbitmq-connection.service';
import { ScheduledCallRepository } from '../state/scheduled-call.repository';

const SCHEDULER_QUEUE = 'scheduler.call-events';
const BOUND_ROUTING_KEYS = [RoutingKey.CallRequested, RoutingKey.CallApproved];


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
      case RoutingKey.CallRequested:
        await this.handleCallRequested(message);
        break;
      case RoutingKey.CallApproved:
        await this.handleCallApproved(message);
        break;
      default:
        this.logger.warn(
          `No handler for routing key "${message.fields.routingKey}"; dropping it.`,
        );
    }

    this.rabbitMq.channel.ack(message);
  }

  private async handleCallRequested(message: ConsumeMessage): Promise<void> {
    const event = JSON.parse(
      message.content.toString('utf8'),
    ) as CallRequestedEvent;

    await this.scheduledCallRepository.upsert({
      requestId: event.requestId,
      email: event.email,
      scheduledAt: new Date(event.scheduledAt),
      status: CallStatus.REQUESTED,
    });

    this.logger.log(`Recorded call request ${event.requestId}.`);
  }

  private async handleCallApproved(message: ConsumeMessage): Promise<void> {
    const event = JSON.parse(
      message.content.toString('utf8'),
    ) as CallApprovedEvent;

    await this.scheduledCallRepository.upsert({
      requestId: event.requestId,
      email: event.email,
      scheduledAt: new Date(event.scheduledAt),
      status: CallStatus.SCHEDULED,
    });

    this.logger.log(`Marked call request ${event.requestId} as scheduled.`);
  }
}
