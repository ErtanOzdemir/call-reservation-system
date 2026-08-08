import {
  CALL_EVENTS_EXCHANGE,
  CallStatus,
  RoutingKey,
} from '@call-reservation/shared-types';
import { RabbitMqConnectionService } from '../shared-kernel/rabbitmq/rabbitmq-connection.service';
import { ScheduledCallRepository } from '../state/scheduled-call.repository';
import { CallEventsConsumer } from './call-events.consumer';

interface FakeMessage {
  content: Buffer;
  fields: { routingKey: string };
}

type MessageHandler = (message: FakeMessage | null) => void;

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
    deliver: (message: FakeMessage | null) => deliver?.(message),
  };
}

function flushMicrotasks(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve));
}

function messageFor(routingKey: string, payload: unknown): FakeMessage {
  return {
    content: Buffer.from(JSON.stringify(payload)),
    fields: { routingKey },
  };
}

describe('CallEventsConsumer', () => {
  it('binds one queue to both call.requested and call.approved', async () => {
    const channel = createChannelMock();
    const rabbitMq = { channel } as unknown as RabbitMqConnectionService;
    const repository = {
      upsert: jest.fn(),
    } as unknown as ScheduledCallRepository;
    const consumer = new CallEventsConsumer(rabbitMq, repository);

    await consumer.onModuleInit();

    expect(channel.assertQueue).toHaveBeenCalledWith('scheduler.call-events', {
      durable: true,
    });
    expect(channel.bindQueue).toHaveBeenCalledWith(
      'scheduler.call-events',
      CALL_EVENTS_EXCHANGE,
      RoutingKey.CallRequested,
    );
    expect(channel.bindQueue).toHaveBeenCalledWith(
      'scheduler.call-events',
      CALL_EVENTS_EXCHANGE,
      RoutingKey.CallApproved,
    );
  });

  it('records a REQUESTED call on call.requested', async () => {
    const channel = createChannelMock();
    const rabbitMq = { channel } as unknown as RabbitMqConnectionService;
    const upsert = jest.fn().mockResolvedValue(undefined);
    const repository = { upsert } as unknown as ScheduledCallRepository;
    const consumer = new CallEventsConsumer(rabbitMq, repository);
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

    expect(upsert).toHaveBeenCalledWith({
      requestId: 'req-1',
      email: 'customer@example.com',
      scheduledAt: new Date('2026-08-10T10:00:00+03:00'),
      status: CallStatus.REQUESTED,
    });
    expect(channel.ack).toHaveBeenCalledWith(message);
  });

  it('marks the call SCHEDULED on call.approved', async () => {
    const channel = createChannelMock();
    const rabbitMq = { channel } as unknown as RabbitMqConnectionService;
    const upsert = jest.fn().mockResolvedValue(undefined);
    const repository = { upsert } as unknown as ScheduledCallRepository;
    const consumer = new CallEventsConsumer(rabbitMq, repository);
    await consumer.onModuleInit();

    const message = messageFor(RoutingKey.CallApproved, {
      requestId: 'req-1',
      email: 'customer@example.com',
      scheduledAt: '2026-08-10T10:00:00+03:00',
      approvedAt: '2026-08-08T09:00:00+03:00',
    });
    channel.deliver(message);
    await flushMicrotasks();

    expect(upsert).toHaveBeenCalledWith({
      requestId: 'req-1',
      email: 'customer@example.com',
      scheduledAt: new Date('2026-08-10T10:00:00+03:00'),
      status: CallStatus.SCHEDULED,
    });
    expect(channel.ack).toHaveBeenCalledWith(message);
  });

  it('acks and drops a message with no matching handler', async () => {
    const channel = createChannelMock();
    const rabbitMq = { channel } as unknown as RabbitMqConnectionService;
    const upsert = jest.fn();
    const repository = { upsert } as unknown as ScheduledCallRepository;
    const consumer = new CallEventsConsumer(rabbitMq, repository);
    await consumer.onModuleInit();

    const message = messageFor('call.canceled', { requestId: 'req-1' });
    channel.deliver(message);
    await flushMicrotasks();

    expect(upsert).not.toHaveBeenCalled();
    expect(channel.ack).toHaveBeenCalledWith(message);
  });

  it('nacks and requeues on failure', async () => {
    const channel = createChannelMock();
    const rabbitMq = { channel } as unknown as RabbitMqConnectionService;
    const upsert = jest.fn().mockRejectedValue(new Error('mongo down'));
    const repository = { upsert } as unknown as ScheduledCallRepository;
    const consumer = new CallEventsConsumer(rabbitMq, repository);
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

  it('ignores a null message from the broker', async () => {
    const channel = createChannelMock();
    const rabbitMq = { channel } as unknown as RabbitMqConnectionService;
    const upsert = jest.fn();
    const repository = { upsert } as unknown as ScheduledCallRepository;
    const consumer = new CallEventsConsumer(rabbitMq, repository);
    await consumer.onModuleInit();

    channel.deliver(null);
    await flushMicrotasks();

    expect(upsert).not.toHaveBeenCalled();
  });
});
