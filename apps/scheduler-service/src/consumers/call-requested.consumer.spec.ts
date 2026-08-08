import {
  CALL_EVENTS_EXCHANGE,
  CallStatus,
  RoutingKey,
} from '@call-reservation/shared-types';
import { RabbitMqConnectionService } from '../shared-kernel/rabbitmq/rabbitmq-connection.service';
import { ScheduledCallRepository } from '../state/scheduled-call.repository';
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
    email: 'Customer@Example.com',
    phoneNumber: '+905551234567',
    scheduledAt: '2026-08-10T10:00:00+03:00',
    requestedByUserId: 'user-1',
  }),
);

describe('CallRequestedConsumer', () => {
  it('binds a durable queue to call.events with the call.requested routing key', async () => {
    const channel = createChannelMock();
    const rabbitMq = { channel } as unknown as RabbitMqConnectionService;
    const repository = {
      upsert: jest.fn(),
    } as unknown as ScheduledCallRepository;
    const consumer = new CallRequestedConsumer(rabbitMq, repository);

    await consumer.onModuleInit();

    expect(channel.assertQueue).toHaveBeenCalledWith('scheduler.call-events', {
      durable: true,
    });
    expect(channel.bindQueue).toHaveBeenCalledWith(
      'scheduler.call-events',
      CALL_EVENTS_EXCHANGE,
      RoutingKey.CallRequested,
    );
  });

  it('records the call request and acks the message', async () => {
    const channel = createChannelMock();
    const rabbitMq = { channel } as unknown as RabbitMqConnectionService;
    const upsert = jest.fn().mockResolvedValue(undefined);
    const repository = { upsert } as unknown as ScheduledCallRepository;
    const consumer = new CallRequestedConsumer(rabbitMq, repository);
    await consumer.onModuleInit();

    const message = { content: validPayload };
    channel.deliver(message);
    await flushMicrotasks();

    expect(upsert).toHaveBeenCalledWith({
      requestId: 'req-1',
      email: 'Customer@Example.com',
      scheduledAt: new Date('2026-08-10T10:00:00+03:00'),
      status: CallStatus.REQUESTED,
    });
    expect(channel.ack).toHaveBeenCalledWith(message);
  });

  it('nacks and requeues the message if persisting fails', async () => {
    const channel = createChannelMock();
    const rabbitMq = { channel } as unknown as RabbitMqConnectionService;
    const upsert = jest.fn().mockRejectedValue(new Error('mongo down'));
    const repository = { upsert } as unknown as ScheduledCallRepository;
    const consumer = new CallRequestedConsumer(rabbitMq, repository);
    await consumer.onModuleInit();

    const message = { content: validPayload };
    channel.deliver(message);
    await flushMicrotasks();

    expect(channel.nack).toHaveBeenCalledWith(message, false, true);
    expect(channel.ack).not.toHaveBeenCalled();
  });

  it('ignores a null message from the broker', async () => {
    const channel = createChannelMock();
    const rabbitMq = { channel } as unknown as RabbitMqConnectionService;
    const upsert = jest.fn();
    const repository = { upsert } as unknown as ScheduledCallRepository;
    const consumer = new CallRequestedConsumer(rabbitMq, repository);
    await consumer.onModuleInit();

    channel.deliver(null);
    await flushMicrotasks();

    expect(upsert).not.toHaveBeenCalled();
  });
});
