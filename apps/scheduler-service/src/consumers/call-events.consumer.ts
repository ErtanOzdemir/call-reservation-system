import {
  CALL_EVENTS_EXCHANGE,
  CallApprovedEvent,
  CallCanceledEvent,
  CallLifecyclePolicy,
  CallStatus,
  RoutingKey,
} from '@call-reservation/shared-types';
import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConsumeMessage } from 'amqplib';
import { randomUUID } from 'node:crypto';
import {
  PROCESSED_EVENT_REPOSITORY,
  ProcessedEventRepository,
} from '../idempotency/processed-event.repository';
import { RabbitMqConnectionService } from '../shared-kernel/rabbitmq/rabbitmq-connection.service';
import {
  SCHEDULED_CALL_REPOSITORY,
  ScheduledCallRepository,
} from '../state/scheduled-call.repository';

const SCHEDULER_QUEUE = 'scheduler.call-events';
const BOUND_ROUTING_KEYS = [RoutingKey.CallApproved, RoutingKey.CallCanceled];
const REMINDER_LEAD_TIME_MS = 2 * 60 * 60 * 1000;

@Injectable()
export class CallEventsConsumer implements OnModuleInit {
  private readonly logger = new Logger(CallEventsConsumer.name);

  constructor(
    private readonly rabbitMq: RabbitMqConnectionService,
    @Inject(SCHEDULED_CALL_REPOSITORY)
    private readonly scheduledCallRepository: ScheduledCallRepository,
    @Inject(PROCESSED_EVENT_REPOSITORY)
    private readonly processedEvents: ProcessedEventRepository,
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
    const payload: unknown = JSON.parse(message.content.toString('utf8'));

    const { eventId } = payload as { eventId?: string };

    if (eventId && !(await this.processedEvents.claim(eventId))) {
      this.logger.log(
        `Skipping already-processed event ${eventId} ("${message.fields.routingKey}").`,
      );
      this.rabbitMq.channel.ack(message);
      return;
    }

    try {
      switch (message.fields.routingKey) {
        case RoutingKey.CallApproved:
          await this.handleCallApproved(payload as CallApprovedEvent);
          break;
        case RoutingKey.CallCanceled:
          await this.handleCallCanceled(payload as CallCanceledEvent);
          break;
        default:
          this.logger.warn(
            `No handler for routing key "${message.fields.routingKey}"; dropping it.`,
          );
      }
    } catch (error) {
      // Release the claim so a redelivery (triggered by the nack below, one
      // level up) can actually retry instead of being skipped as a false
      // duplicate for a write that never happened.
      if (eventId) {
        await this.processedEvents.release(eventId);
      }
      throw error;
    }

    this.rabbitMq.channel.ack(message);
  }

  /**
   * Guards against a stale event retry (its own earlier attempt's claim was
   * released after that attempt failed) re-applying a transition the
   * request has already moved past, e.g. a late call.approved resurrecting
   * an already-CANCELED request.
   */
  private async isStaleTransition(
    requestId: string,
    to: CallStatus,
  ): Promise<boolean> {
    const existing =
      await this.scheduledCallRepository.findByRequestId(requestId);

    if (
      existing &&
      !CallLifecyclePolicy.isTransitionAllowed(existing.status, to)
    ) {
      this.logger.log(
        `Skipping stale event for ${requestId}: already ${existing.status}.`,
      );
      return true;
    }

    return false;
  }

  private async handleCallApproved(event: CallApprovedEvent): Promise<void> {
    if (await this.isStaleTransition(event.requestId, CallStatus.SCHEDULED)) {
      return;
    }

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
        adminEmail: event.adminEmail,
      },
      { scheduleReminderAt: targetFireAt, eventId: randomUUID() },
    );

    this.logger.log(`Marked call request ${event.requestId} as scheduled.`);
  }

  private async handleCallCanceled(event: CallCanceledEvent): Promise<void> {
    if (await this.isStaleTransition(event.requestId, CallStatus.CANCELED)) {
      return;
    }

    await this.scheduledCallRepository.cancel(event.requestId);

    this.logger.log(`Marked call request ${event.requestId} as canceled.`);
  }
}
