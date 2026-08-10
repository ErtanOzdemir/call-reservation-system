import { RabbitMqConnectionService } from '../shared-kernel/rabbitmq/rabbitmq-connection.service';
import { createChangeStreamModelMock } from '../shared-kernel/testing/change-stream-model.mock';
import { ScheduledCallDocument } from './scheduled-call.schema';
import { ReminderOutboxDispatcherService } from './reminder-outbox-dispatcher.service';

function flushMicrotasks(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve));
}

describe('ReminderOutboxDispatcherService', () => {
  it('dispatches a reminder already pending at startup and clears it', async () => {
    const targetFireAt = new Date(Date.now() + 60_000);
    const { model, updateOne } = createChangeStreamModelMock<ScheduledCallDocument>([
      {
        requestId: 'req-1',
        pendingReminder: { eventId: 'event-1', requestId: 'req-1', targetFireAt },
      },
    ]);
    const rabbitMq = {
      publish: jest.fn(),
    } as unknown as RabbitMqConnectionService;
    const service = new ReminderOutboxDispatcherService(model, rabbitMq);

    await service.onModuleInit();

    expect(rabbitMq.publish).toHaveBeenCalledWith(
      'reminder.delay',
      'reminder.wakeup',
      { requestId: 'req-1', eventId: 'event-1' },
      { headers: { 'x-delay': expect.any(Number) } },
    );
    expect(updateOne).toHaveBeenCalledWith(
      { requestId: 'req-1', 'pendingReminder.targetFireAt': targetFireAt },
      { $unset: { pendingReminder: '' } },
    );
  });

  it('recomputes the delay from targetFireAt rather than trusting a stale value', async () => {
    // Already due — should clamp to 0, not go negative.
    const targetFireAt = new Date(Date.now() - 60_000);
    const { model } = createChangeStreamModelMock<ScheduledCallDocument>([
      {
        requestId: 'req-1',
        pendingReminder: { eventId: 'event-1', requestId: 'req-1', targetFireAt },
      },
    ]);
    const rabbitMq = {
      publish: jest.fn(),
    } as unknown as RabbitMqConnectionService;
    const service = new ReminderOutboxDispatcherService(model, rabbitMq);

    await service.onModuleInit();

    expect(rabbitMq.publish).toHaveBeenCalledWith(
      'reminder.delay',
      'reminder.wakeup',
      { requestId: 'req-1', eventId: 'event-1' },
      { headers: { 'x-delay': 0 } },
    );
  });

  it('does nothing for a request with no pending reminder', async () => {
    const { model, updateOne } = createChangeStreamModelMock<ScheduledCallDocument>([
      { requestId: 'req-1', pendingReminder: undefined },
    ]);
    const rabbitMq = {
      publish: jest.fn(),
    } as unknown as RabbitMqConnectionService;
    const service = new ReminderOutboxDispatcherService(model, rabbitMq);

    await service.onModuleInit();

    expect(rabbitMq.publish).not.toHaveBeenCalled();
    expect(updateOne).not.toHaveBeenCalled();
  });

  it('dispatches a reminder that arrives through the live change stream', async () => {
    const { model, emitChange } = createChangeStreamModelMock<ScheduledCallDocument>([]);
    const rabbitMq = {
      publish: jest.fn(),
    } as unknown as RabbitMqConnectionService;
    const service = new ReminderOutboxDispatcherService(model, rabbitMq);

    await service.onModuleInit();
    emitChange({
      fullDocument: {
        requestId: 'req-2',
        pendingReminder: {
          eventId: 'event-2',
          requestId: 'req-2',
          targetFireAt: new Date(Date.now() + 120_000),
        },
      },
    });
    await flushMicrotasks();

    expect(rabbitMq.publish).toHaveBeenCalledWith(
      'reminder.delay',
      'reminder.wakeup',
      { requestId: 'req-2', eventId: 'event-2' },
      { headers: { 'x-delay': expect.any(Number) } },
    );
  });

  it('does not clear the pending reminder if the broker publish fails', async () => {
    const targetFireAt = new Date(Date.now() + 60_000);
    const { model, updateOne } = createChangeStreamModelMock<ScheduledCallDocument>([
      {
        requestId: 'req-1',
        pendingReminder: { eventId: 'event-1', requestId: 'req-1', targetFireAt },
      },
    ]);
    const rabbitMq = {
      publish: jest.fn().mockRejectedValue(new Error('broker nacked it')),
    } as unknown as RabbitMqConnectionService;
    const service = new ReminderOutboxDispatcherService(model, rabbitMq);

    await service.onModuleInit();

    expect(updateOne).not.toHaveBeenCalled();
  });

  it('isolates a publish failure to one document during the startup sweep', async () => {
    const { model } = createChangeStreamModelMock<ScheduledCallDocument>([
      {
        requestId: 'req-bad',
        pendingReminder: {
          eventId: 'event-bad',
          requestId: 'req-bad',
          targetFireAt: new Date(Date.now() + 60_000),
        },
      },
      {
        requestId: 'req-ok',
        pendingReminder: {
          eventId: 'event-ok',
          requestId: 'req-ok',
          targetFireAt: new Date(Date.now() + 60_000),
        },
      },
    ]);
    const publish = jest
      .fn()
      .mockRejectedValueOnce(new Error('channel closed'))
      .mockResolvedValueOnce(undefined);
    const rabbitMq = { publish } as unknown as RabbitMqConnectionService;
    const service = new ReminderOutboxDispatcherService(model, rabbitMq);

    await service.onModuleInit();

    expect(publish).toHaveBeenCalledTimes(2);
    expect(publish).toHaveBeenNthCalledWith(
      2,
      'reminder.delay',
      'reminder.wakeup',
      { requestId: 'req-ok', eventId: 'event-ok' },
      { headers: { 'x-delay': expect.any(Number) } },
    );
  });

  it('closes the change stream on module destroy', async () => {
    const { model, changeStream } = createChangeStreamModelMock<ScheduledCallDocument>([]);
    const rabbitMq = {
      publish: jest.fn(),
    } as unknown as RabbitMqConnectionService;
    const service = new ReminderOutboxDispatcherService(model, rabbitMq);

    await service.onModuleInit();
    await service.onModuleDestroy();

    expect(changeStream.close).toHaveBeenCalled();
  });
});
