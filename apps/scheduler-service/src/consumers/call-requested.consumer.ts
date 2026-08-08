import {
  CALL_EVENTS_EXCHANGE,
  CallRequestedEvent,
  CallStatus,
  RoutingKey,
} from '@call-reservation/shared-types';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConsumeMessage } from 'amqplib';
import { RabbitMqConnectionService } from '../shared-kernel/rabbitmq/rabbitmq-connection.service';
import { ScheduledCallRepository } from '../state/scheduled-call.repository';

const SCHEDULER_QUEUE = 'scheduler.call-events';

@Injectable()
export class CallRequestedConsumer implements OnModuleInit {
  private readonly logger = new Logger(CallRequestedConsumer.name);

  constructor(
    private readonly rabbitMq: RabbitMqConnectionService,
    private readonly scheduledCallRepository: ScheduledCallRepository,
  ) {}

  async onModuleInit(): Promise<void> {
    const channel = this.rabbitMq.channel;

    await channel.assertQueue(SCHEDULER_QUEUE, { durable: true });
    await channel.bindQueue(
      SCHEDULER_QUEUE,
      CALL_EVENTS_EXCHANGE,
      RoutingKey.CallRequested,
    );

    await channel.consume(SCHEDULER_QUEUE, (message) => {
      if (!message) {
        return;
      }

      this.handleMessage(message).catch((error: unknown) => {
        this.logger.error('Failed to handle call.requested message.', error);
        channel.nack(message, false, true);
      });
    });

    this.logger.log(
      `Listening for "${RoutingKey.CallRequested}" on "${SCHEDULER_QUEUE}".`,
    );
  }

  private async handleMessage(message: ConsumeMessage): Promise<void> {
    const event = JSON.parse(
      message.content.toString('utf8'),
    ) as CallRequestedEvent;

    await this.scheduledCallRepository.upsert({
      requestId: event.requestId,
      email: event.email,
      scheduledAt: new Date(event.scheduledAt),
      status: CallStatus.REQUESTED,
    });

    this.rabbitMq.channel.ack(message);
    this.logger.log(`Recorded call request ${event.requestId}.`);
  }
}
