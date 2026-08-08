import {
  CALL_EVENTS_EXCHANGE,
  RoutingKey,
} from '@call-reservation/shared-types';
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

function messageFor(routingKey: string, payload: unknown) {
  return {
    content: Buffer.from(JSON.stringify(payload)),
    fields: { routingKey },
  };
}

describe('CallEventsConsumer', () => {
  let consoleLogSpy: jest.SpyInstance;

  beforeEach(() => {
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
  });

  it('binds one queue to every event type it emails for', async () => {
    const channel = createChannelMock();
    const rabbitMq = { channel } as unknown as RabbitMqConnectionService;
    const consumer = new CallEventsConsumer(rabbitMq);

    await consumer.onModuleInit();

    expect(channel.assertQueue).toHaveBeenCalledWith(
      'communication.call-events',
      { durable: true },
    );
    for (const routingKey of [
      RoutingKey.CallRequested,
      RoutingKey.CallApproved,
      RoutingKey.CallRejected,
      RoutingKey.ReminderDue,
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
    const consumer = new CallEventsConsumer(rabbitMq);
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

    expect(consoleLogSpy).toHaveBeenCalledTimes(1);
    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining('customer@example.com'),
    );
    expect(channel.ack).toHaveBeenCalledWith(message);
  });

  it('emails the requester on call.approved', async () => {
    const channel = createChannelMock();
    const rabbitMq = { channel } as unknown as RabbitMqConnectionService;
    const consumer = new CallEventsConsumer(rabbitMq);
    await consumer.onModuleInit();

    const message = messageFor(RoutingKey.CallApproved, {
      requestId: 'req-1',
      email: 'customer@example.com',
      scheduledAt: '2026-08-10T10:00:00+03:00',
      approvedAt: '2026-08-08T09:00:00+03:00',
    });
    channel.deliver(message);
    await flushMicrotasks();

    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining('has been approved'),
    );
    expect(channel.ack).toHaveBeenCalledWith(message);
  });

  it('emails the requester on call.rejected', async () => {
    const channel = createChannelMock();
    const rabbitMq = { channel } as unknown as RabbitMqConnectionService;
    const consumer = new CallEventsConsumer(rabbitMq);
    await consumer.onModuleInit();

    const message = messageFor(RoutingKey.CallRejected, {
      requestId: 'req-1',
      email: 'customer@example.com',
      rejectedAt: '2026-08-08T09:00:00+03:00',
    });
    channel.deliver(message);
    await flushMicrotasks();

    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining('rejected by the admin'),
    );
    expect(channel.ack).toHaveBeenCalledWith(message);
  });

  it('emails both the customer and the admin on reminder.due', async () => {
    const channel = createChannelMock();
    const rabbitMq = { channel } as unknown as RabbitMqConnectionService;
    const consumer = new CallEventsConsumer(rabbitMq);
    await consumer.onModuleInit();

    const message = messageFor(RoutingKey.ReminderDue, {
      requestId: 'req-1',
      customerEmail: 'customer@example.com',
      adminEmail: 'admin@call-reservation.local',
      scheduledAt: '2026-08-10T10:00:00+03:00',
    });
    channel.deliver(message);
    await flushMicrotasks();

    expect(consoleLogSpy).toHaveBeenCalledTimes(2);
    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining('to=customer@example.com'),
    );
    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining('to=admin@call-reservation.local'),
    );
    expect(channel.ack).toHaveBeenCalledWith(message);
  });

  it('acks and drops a message with no matching handler', async () => {
    const channel = createChannelMock();
    const rabbitMq = { channel } as unknown as RabbitMqConnectionService;
    const consumer = new CallEventsConsumer(rabbitMq);
    await consumer.onModuleInit();

    const message = messageFor('call.canceled', { requestId: 'req-1' });
    channel.deliver(message);
    await flushMicrotasks();

    expect(consoleLogSpy).not.toHaveBeenCalled();
    expect(channel.ack).toHaveBeenCalledWith(message);
  });

  it('nacks and requeues the message if rendering/sending fails', async () => {
    const channel = createChannelMock();
    const rabbitMq = { channel } as unknown as RabbitMqConnectionService;
    const consumer = new CallEventsConsumer(rabbitMq);
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

  it('ignores a null message from the broker', async () => {
    const channel = createChannelMock();
    const rabbitMq = { channel } as unknown as RabbitMqConnectionService;
    const consumer = new CallEventsConsumer(rabbitMq);
    await consumer.onModuleInit();

    channel.deliver(null);
    await flushMicrotasks();

    expect(consoleLogSpy).not.toHaveBeenCalled();
  });
});
