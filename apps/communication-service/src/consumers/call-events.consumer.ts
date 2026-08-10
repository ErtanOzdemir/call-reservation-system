import {
  CALL_EVENTS_EXCHANGE,
  CallApprovedEvent,
  CallCanceledEvent,
  CallRejectedEvent,
  CallRequestedEvent,
  DigestDueEvent,
  ReminderDueEvent,
  RoutingKey,
} from '@call-reservation/shared-types';
import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConsumeMessage } from 'amqplib';
import {
  PROCESSED_EVENT_REPOSITORY,
  ProcessedEventRepository,
} from '../idempotency/processed-event.repository';
import { EmailSenderService } from '../shared-kernel/email/email-sender.service';
import { EmailMessage } from '../shared-kernel/email/email-message';
import { RabbitMqConnectionService } from '../shared-kernel/rabbitmq/rabbitmq-connection.service';
import { renderCallApprovedEmail } from '../templates/call-approved.template';
import { renderCallCanceledEmail } from '../templates/call-canceled.template';
import { renderCallRejectedEmail } from '../templates/call-rejected.template';
import { renderCallRequestedEmail } from '../templates/call-requested.template';
import { renderDigestDueEmail } from '../templates/digest-due.template';
import { renderReminderEmails } from '../templates/reminder.template';

const COMMUNICATION_QUEUE = 'communication.call-events';
const BOUND_ROUTING_KEYS = [
  RoutingKey.CallRequested,
  RoutingKey.CallApproved,
  RoutingKey.CallRejected,
  RoutingKey.CallCanceled,
  RoutingKey.ReminderDue,
  RoutingKey.DigestDue,
];

/** One queue, one consumer — see scheduler-service's CallEventsConsumer for why. */
@Injectable()
export class CallEventsConsumer implements OnModuleInit {
  private readonly logger = new Logger(CallEventsConsumer.name);

  constructor(
    private readonly rabbitMq: RabbitMqConnectionService,
    private readonly emailSender: EmailSenderService,
    @Inject(PROCESSED_EVENT_REPOSITORY)
    private readonly processedEvents: ProcessedEventRepository,
  ) {}

  async onModuleInit(): Promise<void> {
    const channel = this.rabbitMq.channel;

    await channel.assertQueue(COMMUNICATION_QUEUE, { durable: true });

    for (const routingKey of BOUND_ROUTING_KEYS) {
      await channel.bindQueue(
        COMMUNICATION_QUEUE,
        CALL_EVENTS_EXCHANGE,
        routingKey,
      );
    }

    // One unacked message at a time, so emails for the same request are
    // sent in the order the events actually happened.
    await channel.prefetch(1);

    await channel.consume(COMMUNICATION_QUEUE, (message) => {
      if (!message) {
        return;
      }

      this.handleMessage(message).catch(() => {
        this.logger.error(
          `Failed to handle "${message.fields.routingKey}" message.`,
        );
        channel.nack(message, false, true);
      });
    });

    this.logger.log(
      `Listening for [${BOUND_ROUTING_KEYS.join(', ')}] on "${COMMUNICATION_QUEUE}".`,
    );
  }

  private async handleMessage(message: ConsumeMessage): Promise<void> {
    const payload: unknown = JSON.parse(message.content.toString('utf8'));
    // Not part of any event's domain type — merged onto the wire at
    // publish time by the sending outbox, so it's read off the raw payload.
    const { eventId } = payload as { eventId?: string };

    if (eventId && !(await this.processedEvents.claim(eventId))) {
      this.logger.log(
        `Skipping already-processed event ${eventId} ("${message.fields.routingKey}").`,
      );
      this.rabbitMq.channel.ack(message);
      return;
    }

    try {
      await this.dispatch(message.fields.routingKey, payload);
    } catch (error) {
      // Release the claim so a redelivery (triggered by the nack below,
      // one level up) can actually retry instead of being skipped as a
      // false duplicate for an email that never went out.
      if (eventId) {
        await this.processedEvents.release(eventId);
      }
      throw error;
    }

    this.rabbitMq.channel.ack(message);
  }

  private async dispatch(routingKey: string, payload: unknown): Promise<void> {
    switch (routingKey) {
      case RoutingKey.CallRequested:
        await this.send(
          renderCallRequestedEmail(payload as CallRequestedEvent),
        );
        break;
      case RoutingKey.CallApproved:
        await this.send(renderCallApprovedEmail(payload as CallApprovedEvent));
        break;
      case RoutingKey.CallRejected:
        await this.send(renderCallRejectedEmail(payload as CallRejectedEvent));
        break;
      case RoutingKey.CallCanceled:
        await this.send(renderCallCanceledEmail(payload as CallCanceledEvent));
        break;
      case RoutingKey.ReminderDue:
        for (const email of renderReminderEmails(payload as ReminderDueEvent)) {
          await this.send(email);
        }
        break;
      case RoutingKey.DigestDue:
        await this.send(renderDigestDueEmail(payload as DigestDueEvent));
        break;
      default:
        this.logger.warn(
          `No handler for routing key "${routingKey}"; dropping it.`,
        );
    }
  }

  private async send(email: EmailMessage): Promise<void> {
    await this.emailSender.send(email);
  }
}
