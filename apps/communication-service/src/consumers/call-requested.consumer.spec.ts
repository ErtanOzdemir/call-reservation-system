import {
  CALL_EVENTS_EXCHANGE,
  RoutingKey,
} from '@call-reservation/shared-types';
import { RabbitMqConnectionService } from '../shared-kernel/rabbitmq/rabbitmq-connection.service';
import { CallRequestedConsumer } from './call-requested.consumer';

type MessageHandler = (message: { content: Buffer } | null) => void;

function createChannelMock() {
  let deliver: MessageHandler | undefined;

  return {
    assertQueue: jest.fn(),
    bindQueue: jest.fn(),
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

const validPayload = Buffer.from(
  JSON.stringify({
    requestId: 'req-1',
    email: 'customer@example.com',
    phoneNumber: '+905551234567',
    scheduledAt: '2026-08-10T10:00:00+03:00',
    requestedByUserId: 'user-1',
  }),
);

describe('CallRequestedConsumer', () => {
  let consoleLogSpy: jest.SpyInstance;

  beforeEach(() => {
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
  });

  it('binds a durable queue to call.events with the call.requested routing key', async () => {
    const channel = createChannelMock();
    const rabbitMq = { channel } as unknown as RabbitMqConnectionService;
    const consumer = new CallRequestedConsumer(rabbitMq);

    await consumer.onModuleInit();

    expect(channel.assertQueue).toHaveBeenCalledWith(
      'communication.call-events',
      { durable: true },
    );
    expect(channel.bindQueue).toHaveBeenCalledWith(
      'communication.call-events',
      CALL_EVENTS_EXCHANGE,
      RoutingKey.CallRequested,
    );
  });

  it('logs the rendered email and acks the message', async () => {
    const channel = createChannelMock();
    const rabbitMq = { channel } as unknown as RabbitMqConnectionService;
    const consumer = new CallRequestedConsumer(rabbitMq);
    await consumer.onModuleInit();

    const message = { content: validPayload };
    channel.deliver(message);
    await flushMicrotasks();

    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining('customer@example.com'),
    );
    expect(channel.ack).toHaveBeenCalledWith(message);
  });

  it('nacks and requeues the message if rendering/sending fails', async () => {
    const channel = createChannelMock();
    const rabbitMq = { channel } as unknown as RabbitMqConnectionService;
    const consumer = new CallRequestedConsumer(rabbitMq);
    await consumer.onModuleInit();

    const malformedMessage = { content: Buffer.from('not-json') };
    channel.deliver(malformedMessage);
    await flushMicrotasks();

    expect(channel.nack).toHaveBeenCalledWith(malformedMessage, false, true);
    expect(channel.ack).not.toHaveBeenCalled();
  });

  it('ignores a null message from the broker', async () => {
    const channel = createChannelMock();
    const rabbitMq = { channel } as unknown as RabbitMqConnectionService;
    const consumer = new CallRequestedConsumer(rabbitMq);
    await consumer.onModuleInit();

    channel.deliver(null);
    await flushMicrotasks();

    expect(consoleLogSpy).not.toHaveBeenCalled();
  });
});
