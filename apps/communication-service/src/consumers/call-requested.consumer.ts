import {
  CALL_EVENTS_EXCHANGE,
  CallRequestedEvent,
  RoutingKey,
} from '@call-reservation/shared-types';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConsumeMessage } from 'amqplib';
import { RabbitMqConnectionService } from '../shared-kernel/rabbitmq/rabbitmq-connection.service';
import { renderCallRequestedEmail } from '../templates/call-requested.template';

const COMMUNICATION_QUEUE = 'communication.call-events';

@Injectable()
export class CallRequestedConsumer implements OnModuleInit {
  private readonly logger = new Logger(CallRequestedConsumer.name);

  constructor(private readonly rabbitMq: RabbitMqConnectionService) {}

  async onModuleInit(): Promise<void> {
    const channel = this.rabbitMq.channel;

    await channel.assertQueue(COMMUNICATION_QUEUE, { durable: true });
    await channel.bindQueue(
      COMMUNICATION_QUEUE,
      CALL_EVENTS_EXCHANGE,
      RoutingKey.CallRequested,
    );

    await channel.consume(COMMUNICATION_QUEUE, (message) => {
      if (!message) {
        return;
      }

      this.handleMessage(message).catch((error: unknown) => {
        this.logger.error('Failed to handle call.requested message.', error);
        channel.nack(message, false, true);
      });
    });

    this.logger.log(
      `Listening for "${RoutingKey.CallRequested}" on "${COMMUNICATION_QUEUE}".`,
    );
  }

  private async handleMessage(message: ConsumeMessage): Promise<void> {
    const event = JSON.parse(
      message.content.toString('utf8'),
    ) as CallRequestedEvent;
    const email = renderCallRequestedEmail(event);

    // Per assignment scope: a console.log stands in for actually sending mail.
    console.log(`[email] to=${email.to} subject="${email.subject}"\n${email.body}`);

    this.rabbitMq.channel.ack(message);
  }
}
