import {
  CALL_EVENTS_EXCHANGE,
  RoutingKey,
} from '@call-reservation/shared-types';
import { ProcessedEventRepository } from '../idempotency/processed-event.repository';
import { EmailSenderService } from '../shared-kernel/email/email-sender.service';
import { RabbitMqConnectionService } from '../shared-kernel/rabbitmq/rabbitmq-connection.service';
import { CallEventsConsumer } from './call-events.consumer';

type MessageHandler = (message: { content: Buffer } | null) => void;

function createChannelMock() {
  let deliver: MessageHandler | undefined;

  return {
    assertQueue: jest.fn(),
    bindQueue: jest.fn(),
    prefetch: jest.fn().mockResolvedValue(undefined),
    consume: jest.fn((_queue: string, handler: MessageHandler) => {
      deliver = handler;
    }),
    ack: jest.fn(),
    nack: jest.fn(),
    deliver: (message: { content: Buffer } | null) => deliver?.(message),
  };
}

function flushMicrotasks(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve));
}

function createEmailSenderMock() {
  return {
    send: jest.fn().mockResolvedValue(undefined),
  };
}

function createProcessedEventsMock() {
  return {
    claim: jest.fn().mockResolvedValue(true),
    release: jest.fn().mockResolvedValue(undefined),
  };
}

function messageFor(routingKey: string, payload: unknown) {
  return {
    content: Buffer.from(JSON.stringify(payload)),
    fields: { routingKey },
  };
}

describe('CallEventsConsumer', () => {
  it('binds one queue to every event type it emails for', async () => {
    const channel = createChannelMock();
    const rabbitMq = { channel } as unknown as RabbitMqConnectionService;
    const emailSender = createEmailSenderMock();
    const processedEvents = createProcessedEventsMock();
    const consumer = new CallEventsConsumer(
      rabbitMq,
      emailSender as unknown as EmailSenderService,
      processedEvents as unknown as ProcessedEventRepository,
    );

    await consumer.onModuleInit();

    expect(channel.assertQueue).toHaveBeenCalledWith(
      'communication.call-events',
      { durable: true },
    );
    for (const routingKey of [
      RoutingKey.CallRequested,
      RoutingKey.CallApproved,
      RoutingKey.CallRejected,
      RoutingKey.CallCanceled,
      RoutingKey.ReminderDue,
      RoutingKey.DigestDue,
    ]) {
      expect(channel.bindQueue).toHaveBeenCalledWith(
        'communication.call-events',
        CALL_EVENTS_EXCHANGE,
        routingKey,
      );
    }
  });

  it('emails the requester on call.requested', async () => {
    const channel = createChannelMock();
    const rabbitMq = { channel } as unknown as RabbitMqConnectionService;
    const emailSender = createEmailSenderMock();
    const processedEvents = createProcessedEventsMock();
    const consumer = new CallEventsConsumer(
      rabbitMq,
      emailSender as unknown as EmailSenderService,
      processedEvents as unknown as ProcessedEventRepository,
    );
    await consumer.onModuleInit();

    const message = messageFor(RoutingKey.CallRequested, {
      requestId: 'req-1',
      email: 'customer@example.com',
      phoneNumber: '+905551234567',
      scheduledAt: '2026-08-10T10:00:00+03:00',
      requestedByUserId: 'user-1',
    });
    channel.deliver(message);
    await flushMicrotasks();

    expect(emailSender.send).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'customer@example.com',
        subject: 'We received your call request',
      }),
    );
    expect(channel.ack).toHaveBeenCalledWith(message);
  });

  it('emails the requester on call.approved', async () => {
    const channel = createChannelMock();
    const rabbitMq = { channel } as unknown as RabbitMqConnectionService;
    const emailSender = createEmailSenderMock();
    const processedEvents = createProcessedEventsMock();
    const consumer = new CallEventsConsumer(
      rabbitMq,
      emailSender as unknown as EmailSenderService,
      processedEvents as unknown as ProcessedEventRepository,
    );
    await consumer.onModuleInit();

    const message = messageFor(RoutingKey.CallApproved, {
      requestId: 'req-1',
      email: 'customer@example.com',
      scheduledAt: '2026-08-10T10:00:00+03:00',
      approvedAt: '2026-08-08T09:00:00+03:00',
    });
    channel.deliver(message);
    await flushMicrotasks();

    expect(emailSender.send).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'customer@example.com',
        body: expect.stringContaining('has been approved'),
      }),
    );
    expect(channel.ack).toHaveBeenCalledWith(message);
  });

  it('emails the requester on call.rejected', async () => {
    const channel = createChannelMock();
    const rabbitMq = { channel } as unknown as RabbitMqConnectionService;
    const emailSender = createEmailSenderMock();
    const processedEvents = createProcessedEventsMock();
    const consumer = new CallEventsConsumer(
      rabbitMq,
      emailSender as unknown as EmailSenderService,
      processedEvents as unknown as ProcessedEventRepository,
    );
    await consumer.onModuleInit();

    const message = messageFor(RoutingKey.CallRejected, {
      requestId: 'req-1',
      email: 'customer@example.com',
      rejectedAt: '2026-08-08T09:00:00+03:00',
    });
    channel.deliver(message);
    await flushMicrotasks();

    expect(emailSender.send).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'customer@example.com',
        body: expect.stringContaining('rejected by the admin'),
      }),
    );
    expect(channel.ack).toHaveBeenCalledWith(message);
  });

  it('emails the requester on call.canceled', async () => {
    const channel = createChannelMock();
    const rabbitMq = { channel } as unknown as RabbitMqConnectionService;
    const emailSender = createEmailSenderMock();
    const processedEvents = createProcessedEventsMock();
    const consumer = new CallEventsConsumer(
      rabbitMq,
      emailSender as unknown as EmailSenderService,
      processedEvents as unknown as ProcessedEventRepository,
    );
    await consumer.onModuleInit();

    const message = messageFor(RoutingKey.CallCanceled, {
      requestId: 'req-1',
      email: 'customer@example.com',
      canceledAt: '2026-08-08T09:00:00+03:00',
    });
    channel.deliver(message);
    await flushMicrotasks();

    expect(emailSender.send).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'customer@example.com',
        body: expect.stringContaining('canceled by the admin'),
      }),
    );
    expect(channel.ack).toHaveBeenCalledWith(message);
  });

  it('emails both the customer and the admin on reminder.due', async () => {
    const channel = createChannelMock();
    const rabbitMq = { channel } as unknown as RabbitMqConnectionService;
    const emailSender = createEmailSenderMock();
    const processedEvents = createProcessedEventsMock();
    const consumer = new CallEventsConsumer(
      rabbitMq,
      emailSender as unknown as EmailSenderService,
      processedEvents as unknown as ProcessedEventRepository,
    );
    await consumer.onModuleInit();

    const message = messageFor(RoutingKey.ReminderDue, {
      requestId: 'req-1',
      customerEmail: 'customer@example.com',
      adminEmail: 'admin@call-reservation.local',
      scheduledAt: '2026-08-10T10:00:00+03:00',
    });
    channel.deliver(message);
    await flushMicrotasks();

    expect(emailSender.send).toHaveBeenCalledTimes(2);
    expect(emailSender.send).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ to: 'customer@example.com' }),
    );
    expect(emailSender.send).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ to: 'admin@call-reservation.local' }),
    );
    expect(channel.ack).toHaveBeenCalledWith(message);
  });

  it('emails the admin a single digest on digest.due', async () => {
    const channel = createChannelMock();
    const rabbitMq = { channel } as unknown as RabbitMqConnectionService;
    const emailSender = createEmailSenderMock();
    const processedEvents = createProcessedEventsMock();
    const consumer = new CallEventsConsumer(
      rabbitMq,
      emailSender as unknown as EmailSenderService,
      processedEvents as unknown as ProcessedEventRepository,
    );
    await consumer.onModuleInit();

    const message = messageFor(RoutingKey.DigestDue, {
      adminEmail: 'admin@call-reservation.local',
      date: '2026-08-10',
      calls: [
        {
          requestId: 'req-1',
          email: 'customer@example.com',
          scheduledAt: '2026-08-10T07:00:00.000Z',
        },
      ],
    });
    channel.deliver(message);
    await flushMicrotasks();

    expect(emailSender.send).toHaveBeenCalledTimes(1);
    expect(emailSender.send).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'admin@call-reservation.local' }),
    );
    expect(channel.ack).toHaveBeenCalledWith(message);
  });

  it('acks and drops a message with no matching handler', async () => {
    const channel = createChannelMock();
    const rabbitMq = { channel } as unknown as RabbitMqConnectionService;
    const emailSender = createEmailSenderMock();
    const processedEvents = createProcessedEventsMock();
    const consumer = new CallEventsConsumer(
      rabbitMq,
      emailSender as unknown as EmailSenderService,
      processedEvents as unknown as ProcessedEventRepository,
    );
    await consumer.onModuleInit();

    const message = messageFor('unknown.routing.key', { requestId: 'req-1' });
    channel.deliver(message);
    await flushMicrotasks();

    expect(emailSender.send).not.toHaveBeenCalled();
    expect(channel.ack).toHaveBeenCalledWith(message);
  });

  it('nacks and requeues the message if rendering/sending fails', async () => {
    const channel = createChannelMock();
    const rabbitMq = { channel } as unknown as RabbitMqConnectionService;
    const emailSender = createEmailSenderMock();
    const processedEvents = createProcessedEventsMock();
    const consumer = new CallEventsConsumer(
      rabbitMq,
      emailSender as unknown as EmailSenderService,
      processedEvents as unknown as ProcessedEventRepository,
    );
    await consumer.onModuleInit();

    const malformedMessage = {
      content: Buffer.from('not-json'),
      fields: { routingKey: RoutingKey.CallRequested },
    };
    channel.deliver(malformedMessage);
    await flushMicrotasks();

    expect(channel.nack).toHaveBeenCalledWith(malformedMessage, false, true);
    expect(channel.ack).not.toHaveBeenCalled();
  });

  it('nacks and requeues the message if SMTP delivery fails', async () => {
    const channel = createChannelMock();
    const rabbitMq = { channel } as unknown as RabbitMqConnectionService;
    const emailSender = createEmailSenderMock();
    emailSender.send.mockRejectedValueOnce(new Error('SMTP unavailable'));
    const processedEvents = createProcessedEventsMock();
    const consumer = new CallEventsConsumer(
      rabbitMq,
      emailSender as unknown as EmailSenderService,
      processedEvents as unknown as ProcessedEventRepository,
    );
    await consumer.onModuleInit();

    const message = messageFor(RoutingKey.CallRequested, {
      requestId: 'req-1',
      email: 'customer@example.com',
      phoneNumber: '+905551234567',
      scheduledAt: '2026-08-10T10:00:00+03:00',
      requestedByUserId: 'user-1',
    });
    channel.deliver(message);
    await flushMicrotasks();

    expect(channel.nack).toHaveBeenCalledWith(message, false, true);
    expect(channel.ack).not.toHaveBeenCalled();
  });

  it('skips an already-claimed event without sending, and acks it', async () => {
    const channel = createChannelMock();
    const rabbitMq = { channel } as unknown as RabbitMqConnectionService;
    const emailSender = createEmailSenderMock();
    const processedEvents = createProcessedEventsMock();
    processedEvents.claim.mockResolvedValueOnce(false);
    const consumer = new CallEventsConsumer(
      rabbitMq,
      emailSender as unknown as EmailSenderService,
      processedEvents as unknown as ProcessedEventRepository,
    );
    await consumer.onModuleInit();

    const message = messageFor(RoutingKey.CallRequested, {
      eventId: 'event-1',
      requestId: 'req-1',
      email: 'customer@example.com',
      phoneNumber: '+905551234567',
      scheduledAt: '2026-08-10T10:00:00+03:00',
      requestedByUserId: 'user-1',
    });
    channel.deliver(message);
    await flushMicrotasks();

    expect(processedEvents.claim).toHaveBeenCalledWith('event-1');
    expect(emailSender.send).not.toHaveBeenCalled();
    expect(channel.ack).toHaveBeenCalledWith(message);
  });

  it('releases the claim so a redelivery can retry after SMTP delivery fails', async () => {
    const channel = createChannelMock();
    const rabbitMq = { channel } as unknown as RabbitMqConnectionService;
    const emailSender = createEmailSenderMock();
    emailSender.send.mockRejectedValueOnce(new Error('SMTP unavailable'));
    const processedEvents = createProcessedEventsMock();
    const consumer = new CallEventsConsumer(
      rabbitMq,
      emailSender as unknown as EmailSenderService,
      processedEvents as unknown as ProcessedEventRepository,
    );
    await consumer.onModuleInit();

    const message = messageFor(RoutingKey.CallRequested, {
      eventId: 'event-1',
      requestId: 'req-1',
      email: 'customer@example.com',
      phoneNumber: '+905551234567',
      scheduledAt: '2026-08-10T10:00:00+03:00',
      requestedByUserId: 'user-1',
    });
    channel.deliver(message);
    await flushMicrotasks();

    expect(processedEvents.claim).toHaveBeenCalledWith('event-1');
    expect(processedEvents.release).toHaveBeenCalledWith('event-1');
    expect(channel.nack).toHaveBeenCalledWith(message, false, true);
    expect(channel.ack).not.toHaveBeenCalled();
  });

  it('does not touch the idempotency store for a payload with no eventId', async () => {
    const channel = createChannelMock();
    const rabbitMq = { channel } as unknown as RabbitMqConnectionService;
    const emailSender = createEmailSenderMock();
    const processedEvents = createProcessedEventsMock();
    const consumer = new CallEventsConsumer(
      rabbitMq,
      emailSender as unknown as EmailSenderService,
      processedEvents as unknown as ProcessedEventRepository,
    );
    await consumer.onModuleInit();

    const message = messageFor(RoutingKey.CallRequested, {
      requestId: 'req-1',
      email: 'customer@example.com',
      phoneNumber: '+905551234567',
      scheduledAt: '2026-08-10T10:00:00+03:00',
      requestedByUserId: 'user-1',
    });
    channel.deliver(message);
    await flushMicrotasks();

    expect(processedEvents.claim).not.toHaveBeenCalled();
    expect(emailSender.send).toHaveBeenCalled();
    expect(channel.ack).toHaveBeenCalledWith(message);
  });

  it('ignores a null message from the broker', async () => {
    const channel = createChannelMock();
    const rabbitMq = { channel } as unknown as RabbitMqConnectionService;
    const emailSender = createEmailSenderMock();
    const processedEvents = createProcessedEventsMock();
    const consumer = new CallEventsConsumer(
      rabbitMq,
      emailSender as unknown as EmailSenderService,
      processedEvents as unknown as ProcessedEventRepository,
    );
    await consumer.onModuleInit();

    channel.deliver(null);
    await flushMicrotasks();

    expect(emailSender.send).not.toHaveBeenCalled();
  });
});
