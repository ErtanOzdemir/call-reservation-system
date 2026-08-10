import {
  CALL_EVENTS_EXCHANGE,
  CallStatus,
  RoutingKey,
} from '@call-reservation/shared-types';
import { ConfigService } from '@nestjs/config';
import {
  RabbitMqConnectionService,
  REMINDER_DELAY_EXCHANGE,
  REMINDER_WAKEUP_ROUTING_KEY,
} from '../shared-kernel/rabbitmq/rabbitmq-connection.service';
import { InMemoryScheduledCallRepository } from '../state/testing/in-memory-scheduled-call-repository';
import { ReminderWakeupConsumer } from './reminder-wakeup.consumer';

interface FakeMessage {
  content: Buffer;
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
    ack: jest.fn(),
    nack: jest.fn(),
    deliver: (message: FakeMessage | null) => deliver?.(message),
  };
}

function createRabbitMqMock(channel: ReturnType<typeof createChannelMock>) {
  return {
    channel,
    publish: jest.fn().mockResolvedValue(undefined),
  } as unknown as RabbitMqConnectionService;
}

function flushMicrotasks(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve));
}

function createConfigServiceMock(): ConfigService {
  return {
    getOrThrow: jest.fn(() => 'admin@call-reservation.local'),
  } as unknown as ConfigService;
}

describe('ReminderWakeupConsumer', () => {
  it('binds the wakeup queue to the delayed exchange', async () => {
    const channel = createChannelMock();
    const rabbitMq = createRabbitMqMock(channel);
    const repository = new InMemoryScheduledCallRepository();
    const consumer = new ReminderWakeupConsumer(
      rabbitMq,
      repository,
      createConfigServiceMock(),
    );

    await consumer.onModuleInit();

    expect(channel.assertQueue).toHaveBeenCalledWith(
      'scheduler.reminder-wakeup',
      { durable: true },
    );
    expect(channel.bindQueue).toHaveBeenCalledWith(
      'scheduler.reminder-wakeup',
      REMINDER_DELAY_EXCHANGE,
      REMINDER_WAKEUP_ROUTING_KEY,
    );
  });

  it('publishes reminder.due when the call is still scheduled', async () => {
    const channel = createChannelMock();
    const rabbitMq = createRabbitMqMock(channel);
    const repository = new InMemoryScheduledCallRepository();
    repository.seed({
      requestId: 'req-1',
      email: 'customer@example.com',
      scheduledAt: new Date('2026-08-10T10:00:00+03:00'),
      status: CallStatus.SCHEDULED,
    });
    const consumer = new ReminderWakeupConsumer(
      rabbitMq,
      repository,
      createConfigServiceMock(),
    );
    await consumer.onModuleInit();

    const message = {
      content: Buffer.from(
        JSON.stringify({ requestId: 'req-1', eventId: 'event-1' }),
      ),
    };
    channel.deliver(message);
    await flushMicrotasks();

    expect(rabbitMq.publish).toHaveBeenCalledWith(
      CALL_EVENTS_EXCHANGE,
      RoutingKey.ReminderDue,
      {
        requestId: 'req-1',
        customerEmail: 'customer@example.com',
        adminEmail: 'admin@call-reservation.local',
        scheduledAt: '2026-08-10T07:00:00.000Z',
        eventId: 'event-1',
      },
    );
    expect(channel.ack).toHaveBeenCalledWith(message);
  });

  it('reuses the wakeup eventId on redelivery, so a duplicate wakeup produces a recognizably duplicate reminder.due', async () => {
    const channel = createChannelMock();
    const rabbitMq = createRabbitMqMock(channel);
    const repository = new InMemoryScheduledCallRepository();
    repository.seed({
      requestId: 'req-1',
      email: 'customer@example.com',
      scheduledAt: new Date('2026-08-10T10:00:00+03:00'),
      status: CallStatus.SCHEDULED,
    });
    const consumer = new ReminderWakeupConsumer(
      rabbitMq,
      repository,
      createConfigServiceMock(),
    );
    await consumer.onModuleInit();

    const redeliveredMessage = {
      content: Buffer.from(
        JSON.stringify({ requestId: 'req-1', eventId: 'event-1' }),
      ),
    };
    channel.deliver(redeliveredMessage);
    await flushMicrotasks();
    channel.deliver(redeliveredMessage);
    await flushMicrotasks();

    expect(rabbitMq.publish).toHaveBeenCalledTimes(2);
    const [firstCall, secondCall] = jest.mocked(rabbitMq.publish).mock.calls;
    expect(firstCall[2]).toMatchObject({ eventId: 'event-1' });
    expect(secondCall[2]).toMatchObject({ eventId: 'event-1' });
  });

  it('drops the wakeup without publishing if the call is no longer scheduled', async () => {
    const channel = createChannelMock();
    const rabbitMq = createRabbitMqMock(channel);
    const repository = new InMemoryScheduledCallRepository();
    repository.seed({
      requestId: 'req-1',
      email: 'customer@example.com',
      scheduledAt: new Date('2026-08-10T10:00:00+03:00'),
      status: CallStatus.REJECTED,
    });
    const consumer = new ReminderWakeupConsumer(
      rabbitMq,
      repository,
      createConfigServiceMock(),
    );
    await consumer.onModuleInit();

    const message = {
      content: Buffer.from(JSON.stringify({ requestId: 'req-1' })),
    };
    channel.deliver(message);
    await flushMicrotasks();

    expect(rabbitMq.publish).not.toHaveBeenCalled();
    expect(channel.ack).toHaveBeenCalledWith(message);
  });

  it('drops the wakeup without publishing if the call no longer exists', async () => {
    const channel = createChannelMock();
    const rabbitMq = createRabbitMqMock(channel);
    const repository = new InMemoryScheduledCallRepository();
    const consumer = new ReminderWakeupConsumer(
      rabbitMq,
      repository,
      createConfigServiceMock(),
    );
    await consumer.onModuleInit();

    const message = {
      content: Buffer.from(JSON.stringify({ requestId: 'req-1' })),
    };
    channel.deliver(message);
    await flushMicrotasks();

    expect(rabbitMq.publish).not.toHaveBeenCalled();
    expect(channel.ack).toHaveBeenCalledWith(message);
  });

  it('nacks and requeues if the lookup fails', async () => {
    const channel = createChannelMock();
    const rabbitMq = createRabbitMqMock(channel);
    const repository = new InMemoryScheduledCallRepository();
    jest
      .spyOn(repository, 'findByRequestId')
      .mockRejectedValueOnce(new Error('mongo down'));
    const consumer = new ReminderWakeupConsumer(
      rabbitMq,
      repository,
      createConfigServiceMock(),
    );
    await consumer.onModuleInit();

    const message = {
      content: Buffer.from(JSON.stringify({ requestId: 'req-1' })),
    };
    channel.deliver(message);
    await flushMicrotasks();

    expect(channel.nack).toHaveBeenCalledWith(message, false, true);
    expect(channel.ack).not.toHaveBeenCalled();
  });

  it('nacks and requeues without acking if the broker never confirms the publish', async () => {
    const channel = createChannelMock();
    const rabbitMq = createRabbitMqMock(channel);
    jest
      .mocked(rabbitMq.publish)
      .mockRejectedValue(new Error('broker nacked it'));
    const repository = new InMemoryScheduledCallRepository();
    repository.seed({
      requestId: 'req-1',
      email: 'customer@example.com',
      scheduledAt: new Date('2026-08-10T10:00:00+03:00'),
      status: CallStatus.SCHEDULED,
    });
    const consumer = new ReminderWakeupConsumer(
      rabbitMq,
      repository,
      createConfigServiceMock(),
    );
    await consumer.onModuleInit();

    const message = {
      content: Buffer.from(JSON.stringify({ requestId: 'req-1' })),
    };
    channel.deliver(message);
    await flushMicrotasks();

    expect(channel.nack).toHaveBeenCalledWith(message, false, true);
    expect(channel.ack).not.toHaveBeenCalled();
  });

  it('ignores a null message from the broker', async () => {
    const channel = createChannelMock();
    const rabbitMq = createRabbitMqMock(channel);
    const repository = new InMemoryScheduledCallRepository();
    const findByRequestId = jest.spyOn(repository, 'findByRequestId');
    const consumer = new ReminderWakeupConsumer(
      rabbitMq,
      repository,
      createConfigServiceMock(),
    );
    await consumer.onModuleInit();

    channel.deliver(null);
    await flushMicrotasks();

    expect(findByRequestId).not.toHaveBeenCalled();
  });
});
