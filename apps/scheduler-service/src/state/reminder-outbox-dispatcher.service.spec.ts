import { RabbitMqConnectionService } from '../shared-kernel/rabbitmq/rabbitmq-connection.service';
import { ScheduledCallDocument } from './scheduled-call.schema';
import { ReminderOutboxDispatcherService } from './reminder-outbox-dispatcher.service';

type ChangeListener = (change: unknown) => void;

function createModelMock(pendingRequests: unknown[]) {
  const changeStreamListeners: Record<string, ChangeListener> = {};
  const changeStream = {
    on: jest.fn((event: string, listener: ChangeListener) => {
      changeStreamListeners[event] = listener;
    }),
    close: jest.fn().mockResolvedValue(undefined),
  };

  return {
    find: jest.fn().mockReturnValue({
      exec: jest.fn().mockResolvedValue(pendingRequests),
    }),
    updateOne: jest.fn().mockReturnValue({ exec: jest.fn() }),
    watch: jest.fn().mockReturnValue(changeStream),
    changeStream,
    changeStreamListeners,
  };
}

function flushMicrotasks(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve));
}

describe('ReminderOutboxDispatcherService', () => {
  it('dispatches reminders already pending at startup and clears them', async () => {
    const reminder = {
      _id: 'reminder-1',
      requestId: 'req-1',
      targetFireAt: new Date(Date.now() + 60_000),
    };
    const model = createModelMock([
      { requestId: 'req-1', pendingReminders: [reminder] },
    ]);
    const rabbitMq = {
      channel: { publish: jest.fn() },
    } as unknown as RabbitMqConnectionService;
    const service = new ReminderOutboxDispatcherService(
      model as never as import('mongoose').Model<ScheduledCallDocument>,
      rabbitMq,
    );

    await service.onModuleInit();

    expect(rabbitMq.channel.publish).toHaveBeenCalledWith(
      'reminder.delay',
      'reminder.wakeup',
      Buffer.from(JSON.stringify({ requestId: 'req-1' })),
      { headers: { 'x-delay': expect.any(Number) }, persistent: true },
    );
    expect(model.updateOne).toHaveBeenCalledWith(
      { requestId: 'req-1' },
      { $pull: { pendingReminders: { _id: reminder._id } } },
    );
  });

  it('recomputes the delay from targetFireAt rather than trusting a stale value', async () => {
    // Already due — should clamp to 0, not go negative.
    const reminder = {
      _id: 'reminder-1',
      requestId: 'req-1',
      targetFireAt: new Date(Date.now() - 60_000),
    };
    const model = createModelMock([
      { requestId: 'req-1', pendingReminders: [reminder] },
    ]);
    const rabbitMq = {
      channel: { publish: jest.fn() },
    } as unknown as RabbitMqConnectionService;
    const service = new ReminderOutboxDispatcherService(
      model as never as import('mongoose').Model<ScheduledCallDocument>,
      rabbitMq,
    );

    await service.onModuleInit();

    expect(rabbitMq.channel.publish).toHaveBeenCalledWith(
      'reminder.delay',
      'reminder.wakeup',
      Buffer.from(JSON.stringify({ requestId: 'req-1' })),
      { headers: { 'x-delay': 0 }, persistent: true },
    );
  });

  it('dispatches reminders that arrive through the live change stream', async () => {
    const model = createModelMock([]);
    const rabbitMq = {
      channel: { publish: jest.fn() },
    } as unknown as RabbitMqConnectionService;
    const service = new ReminderOutboxDispatcherService(
      model as never as import('mongoose').Model<ScheduledCallDocument>,
      rabbitMq,
    );

    await service.onModuleInit();
    model.changeStreamListeners['change']({
      fullDocument: {
        requestId: 'req-2',
        pendingReminders: [
          {
            _id: 'reminder-2',
            requestId: 'req-2',
            targetFireAt: new Date(Date.now() + 120_000),
          },
        ],
      },
    });
    await flushMicrotasks();

    expect(rabbitMq.channel.publish).toHaveBeenCalledWith(
      'reminder.delay',
      'reminder.wakeup',
      Buffer.from(JSON.stringify({ requestId: 'req-2' })),
      { headers: { 'x-delay': expect.any(Number) }, persistent: true },
    );
  });

  it('isolates a failure to one document during the startup sweep', async () => {
    const okReminder = {
      _id: 'reminder-ok',
      requestId: 'req-ok',
      targetFireAt: new Date(Date.now() + 60_000),
    };
    const model = createModelMock([
      { requestId: 'req-bad', pendingReminders: null }, // will throw iterating
      { requestId: 'req-ok', pendingReminders: [okReminder] },
    ]);
    const rabbitMq = {
      channel: { publish: jest.fn() },
    } as unknown as RabbitMqConnectionService;
    const service = new ReminderOutboxDispatcherService(
      model as never as import('mongoose').Model<ScheduledCallDocument>,
      rabbitMq,
    );

    await service.onModuleInit();

    expect(rabbitMq.channel.publish).toHaveBeenCalledWith(
      'reminder.delay',
      'reminder.wakeup',
      Buffer.from(JSON.stringify({ requestId: 'req-ok' })),
      { headers: { 'x-delay': expect.any(Number) }, persistent: true },
    );
  });

  it('closes the change stream on module destroy', async () => {
    const model = createModelMock([]);
    const rabbitMq = {
      channel: { publish: jest.fn() },
    } as unknown as RabbitMqConnectionService;
    const service = new ReminderOutboxDispatcherService(
      model as never as import('mongoose').Model<ScheduledCallDocument>,
      rabbitMq,
    );

    await service.onModuleInit();
    await service.onModuleDestroy();

    expect(model.changeStream.close).toHaveBeenCalled();
  });
});
