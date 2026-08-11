import {
  CALL_EVENTS_EXCHANGE,
  CallStatus,
  RoutingKey,
} from '@call-reservation/shared-types';
import { InMemoryProcessedEventRepository } from '../idempotency/testing/in-memory-processed-event-repository';
import { RabbitMqConnectionService } from '../shared-kernel/rabbitmq/rabbitmq-connection.service';
import { InMemoryScheduledCallRepository } from '../state/testing/in-memory-scheduled-call-repository';
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
    prefetch: jest.fn().mockResolvedValue(undefined),
    consume: jest.fn((_queue: string, handler: MessageHandler) => {
      deliver = handler;
    }),
    publish: jest.fn(),
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
  it('binds one queue to call.approved and call.canceled', async () => {
    const channel = createChannelMock();
    const rabbitMq = { channel } as unknown as RabbitMqConnectionService;
    const repository = new InMemoryScheduledCallRepository();
    const processedEvents = new InMemoryProcessedEventRepository();
    const consumer = new CallEventsConsumer(rabbitMq, repository, processedEvents);

    await consumer.onModuleInit();

    expect(channel.assertQueue).toHaveBeenCalledWith('scheduler.call-events', {
      durable: true,
    });
    expect(channel.bindQueue).toHaveBeenCalledWith(
      'scheduler.call-events',
      CALL_EVENTS_EXCHANGE,
      RoutingKey.CallApproved,
    );
    expect(channel.bindQueue).toHaveBeenCalledWith(
      'scheduler.call-events',
      CALL_EVENTS_EXCHANGE,
      RoutingKey.CallCanceled,
    );
  });

  it('marks the call SCHEDULED and queues a reminder wakeup in the same write on call.approved', async () => {
    const channel = createChannelMock();
    const rabbitMq = { channel } as unknown as RabbitMqConnectionService;
    const repository = new InMemoryScheduledCallRepository();
    const processedEvents = new InMemoryProcessedEventRepository();
    const consumer = new CallEventsConsumer(rabbitMq, repository, processedEvents);
    await consumer.onModuleInit();

    const scheduledAt = new Date('2026-08-10T10:00:00+03:00');
    const message = messageFor(RoutingKey.CallApproved, {
      eventId: 'event-1',
      requestId: 'req-1',
      email: 'customer@example.com',
      scheduledAt: scheduledAt.toISOString(),
      approvedAt: '2026-08-08T09:00:00+03:00',
      adminEmail: 'admin@example.com',
    });
    channel.deliver(message);
    await flushMicrotasks();

    expect(repository.upsertCalls).toEqual([
      {
        record: {
          requestId: 'req-1',
          email: 'customer@example.com',
          scheduledAt,
          status: CallStatus.SCHEDULED,
          adminEmail: 'admin@example.com',
        },
        options: {
          scheduleReminderAt: new Date('2026-08-10T08:00:00+03:00'),
          eventId: expect.any(String),
        },
      },
    ]);
    expect(channel.ack).toHaveBeenCalledWith(message);
    // Nothing gets published directly anymore — that's
    // ReminderOutboxDispatcherService's job now, off the write above.
    expect(channel.publish).not.toHaveBeenCalled();
  });

  it('cancels a call and clears its pending reminder on call.canceled', async () => {
    const channel = createChannelMock();
    const rabbitMq = { channel } as unknown as RabbitMqConnectionService;
    const repository = new InMemoryScheduledCallRepository();
    const processedEvents = new InMemoryProcessedEventRepository();
    const consumer = new CallEventsConsumer(rabbitMq, repository, processedEvents);
    await consumer.onModuleInit();

    const message = messageFor(RoutingKey.CallCanceled, {
      eventId: 'event-1',
      requestId: 'req-1',
      email: 'customer@example.com',
      canceledAt: '2026-08-08T09:00:00+03:00',
    });
    channel.deliver(message);
    await flushMicrotasks();

    expect(repository.cancelCalls).toEqual(['req-1']);
    expect(channel.ack).toHaveBeenCalledWith(message);
  });

  it('acks and drops a message with no matching handler', async () => {
    const channel = createChannelMock();
    const rabbitMq = { channel } as unknown as RabbitMqConnectionService;
    const repository = new InMemoryScheduledCallRepository();
    const processedEvents = new InMemoryProcessedEventRepository();
    const consumer = new CallEventsConsumer(rabbitMq, repository, processedEvents);
    await consumer.onModuleInit();

    const message = messageFor('unknown.routing.key', { requestId: 'req-1' });
    channel.deliver(message);
    await flushMicrotasks();

    expect(repository.upsertCalls).toEqual([]);
    expect(channel.ack).toHaveBeenCalledWith(message);
  });

  it('nacks and requeues on failure', async () => {
    const channel = createChannelMock();
    const rabbitMq = { channel } as unknown as RabbitMqConnectionService;
    const repository = new InMemoryScheduledCallRepository();
    jest.spyOn(repository, 'upsert').mockRejectedValueOnce(new Error('mongo down'));
    const processedEvents = new InMemoryProcessedEventRepository();
    const consumer = new CallEventsConsumer(rabbitMq, repository, processedEvents);
    await consumer.onModuleInit();

    const message = messageFor(RoutingKey.CallApproved, {
      eventId: 'event-1',
      requestId: 'req-1',
      email: 'customer@example.com',
      scheduledAt: '2026-08-10T10:00:00+03:00',
      approvedAt: '2026-08-08T09:00:00+03:00',
      adminEmail: 'admin@example.com',
    });
    channel.deliver(message);
    await flushMicrotasks();

    expect(channel.nack).toHaveBeenCalledWith(message, false, true);
    expect(channel.ack).not.toHaveBeenCalled();
  });

  it('ignores a null message from the broker', async () => {
    const channel = createChannelMock();
    const rabbitMq = { channel } as unknown as RabbitMqConnectionService;
    const repository = new InMemoryScheduledCallRepository();
    const processedEvents = new InMemoryProcessedEventRepository();
    const consumer = new CallEventsConsumer(rabbitMq, repository, processedEvents);
    await consumer.onModuleInit();

    channel.deliver(null);
    await flushMicrotasks();

    expect(repository.upsertCalls).toEqual([]);
  });

  it('skips an already-claimed event without touching state, and acks it', async () => {
    const channel = createChannelMock();
    const rabbitMq = { channel } as unknown as RabbitMqConnectionService;
    const repository = new InMemoryScheduledCallRepository();
    const processedEvents = new InMemoryProcessedEventRepository();
    await processedEvents.claim('event-1');
    const consumer = new CallEventsConsumer(rabbitMq, repository, processedEvents);
    await consumer.onModuleInit();

    const message = messageFor(RoutingKey.CallApproved, {
      eventId: 'event-1',
      requestId: 'req-1',
      email: 'customer@example.com',
      scheduledAt: '2026-08-10T10:00:00+03:00',
      approvedAt: '2026-08-08T09:00:00+03:00',
      adminEmail: 'admin@example.com',
    });
    channel.deliver(message);
    await flushMicrotasks();

    expect(processedEvents.claimCalls).toContain('event-1');
    expect(repository.upsertCalls).toEqual([]);
    expect(channel.ack).toHaveBeenCalledWith(message);
  });

  it('releases the claim so a redelivery can retry after the write fails', async () => {
    const channel = createChannelMock();
    const rabbitMq = { channel } as unknown as RabbitMqConnectionService;
    const repository = new InMemoryScheduledCallRepository();
    jest.spyOn(repository, 'upsert').mockRejectedValueOnce(new Error('mongo down'));
    const processedEvents = new InMemoryProcessedEventRepository();
    const consumer = new CallEventsConsumer(rabbitMq, repository, processedEvents);
    await consumer.onModuleInit();

    const message = messageFor(RoutingKey.CallApproved, {
      eventId: 'event-1',
      requestId: 'req-1',
      email: 'customer@example.com',
      scheduledAt: '2026-08-10T10:00:00+03:00',
      approvedAt: '2026-08-08T09:00:00+03:00',
      adminEmail: 'admin@example.com',
    });
    channel.deliver(message);
    await flushMicrotasks();

    expect(processedEvents.claimCalls).toEqual(['event-1']);
    expect(processedEvents.releaseCalls).toEqual(['event-1']);
    expect(channel.nack).toHaveBeenCalledWith(message, false, true);
    expect(channel.ack).not.toHaveBeenCalled();
  });

  it('does not touch the idempotency store for a payload with no eventId', async () => {
    const channel = createChannelMock();
    const rabbitMq = { channel } as unknown as RabbitMqConnectionService;
    const repository = new InMemoryScheduledCallRepository();
    const processedEvents = new InMemoryProcessedEventRepository();
    const consumer = new CallEventsConsumer(rabbitMq, repository, processedEvents);
    await consumer.onModuleInit();

    const message = messageFor(RoutingKey.CallApproved, {
      requestId: 'req-1',
      email: 'customer@example.com',
      scheduledAt: '2026-08-10T10:00:00+03:00',
      approvedAt: '2026-08-08T09:00:00+03:00',
      adminEmail: 'admin@example.com',
    });
    channel.deliver(message);
    await flushMicrotasks();

    expect(processedEvents.claimCalls).toEqual([]);
    expect(repository.upsertCalls).toHaveLength(1);
    expect(channel.ack).toHaveBeenCalledWith(message);
  });
});
