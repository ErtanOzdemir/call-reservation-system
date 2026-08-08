import {
  CALL_EVENTS_EXCHANGE,
  CallStatus,
  RoutingKey,
} from '@call-reservation/shared-types';
import {
  RabbitMqConnectionService,
  REMINDER_DELAY_EXCHANGE,
  REMINDER_WAKEUP_ROUTING_KEY,
} from '../shared-kernel/rabbitmq/rabbitmq-connection.service';
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
    publish: jest.fn(),
    ack: jest.fn(),
    nack: jest.fn(),
    deliver: (message: FakeMessage | null) => deliver?.(message),
  };
}

// queueMicrotask, unlike setImmediate/setTimeout, is untouched by
// jest.useFakeTimers() — safe to use in tests that fake timers.
function flushMicrotasks(): Promise<void> {
  return new Promise((resolve) => {
    queueMicrotask(() => queueMicrotask(() => queueMicrotask(resolve)));
  });
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

  it('marks the call SCHEDULED and schedules a reminder wakeup on call.approved', async () => {
    const channel = createChannelMock();
    const rabbitMq = { channel } as unknown as RabbitMqConnectionService;
    const upsert = jest.fn().mockResolvedValue(undefined);
    const repository = { upsert } as unknown as ScheduledCallRepository;
    const consumer = new CallEventsConsumer(rabbitMq, repository);
    await consumer.onModuleInit();

    // A few days out, so the delay is comfortably positive regardless of
    // when this test happens to run.
    const scheduledAt = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
    const beforePublish = Date.now();
    const message = messageFor(RoutingKey.CallApproved, {
      requestId: 'req-1',
      email: 'customer@example.com',
      scheduledAt: scheduledAt.toISOString(),
      approvedAt: new Date().toISOString(),
    });
    channel.deliver(message);
    await flushMicrotasks();

    expect(upsert).toHaveBeenCalledWith({
      requestId: 'req-1',
      email: 'customer@example.com',
      scheduledAt,
      status: CallStatus.SCHEDULED,
    });
    expect(channel.ack).toHaveBeenCalledWith(message);

    expect(channel.publish).toHaveBeenCalledTimes(1);
    const [exchange, routingKey, content, options] = channel.publish.mock
      .calls[0] as [string, string, Buffer, { headers: { 'x-delay': number } }];
    expect(exchange).toBe(REMINDER_DELAY_EXCHANGE);
    expect(routingKey).toBe(REMINDER_WAKEUP_ROUTING_KEY);
    expect(content).toEqual(Buffer.from(JSON.stringify({ requestId: 'req-1' })));
    // Expected delay ≈ (scheduledAt - 2h) - now, give or take test execution time.
    const expectedDelayMs =
      scheduledAt.getTime() - 2 * 60 * 60 * 1000 - beforePublish;
    expect(options.headers['x-delay']).toBeGreaterThan(expectedDelayMs - 2000);
    expect(options.headers['x-delay']).toBeLessThan(expectedDelayMs + 2000);
  });

  it('clamps the reminder delay to 0 when less than 2 hours remain', async () => {
    const channel = createChannelMock();
    const rabbitMq = { channel } as unknown as RabbitMqConnectionService;
    const repository = {
      upsert: jest.fn().mockResolvedValue(undefined),
    } as unknown as ScheduledCallRepository;
    const consumer = new CallEventsConsumer(rabbitMq, repository);
    await consumer.onModuleInit();

    // Only 45 minutes until the call — well under the 2h lead time, so
    // "2h before" is already in the past regardless of when this runs.
    const scheduledAt = new Date(Date.now() + 45 * 60 * 1000);
    const message = messageFor(RoutingKey.CallApproved, {
      requestId: 'req-1',
      email: 'customer@example.com',
      scheduledAt: scheduledAt.toISOString(),
      approvedAt: new Date().toISOString(),
    });
    channel.deliver(message);
    await flushMicrotasks();

    expect(channel.publish).toHaveBeenCalledWith(
      REMINDER_DELAY_EXCHANGE,
      REMINDER_WAKEUP_ROUTING_KEY,
      Buffer.from(JSON.stringify({ requestId: 'req-1' })),
      { headers: { 'x-delay': 0 }, persistent: true },
    );
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
