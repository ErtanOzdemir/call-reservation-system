import { CALL_EVENTS_EXCHANGE, RoutingKey } from '@call-reservation/shared-types';
import { RabbitMqConnectionService } from '../shared-kernel/rabbitmq/rabbitmq-connection.service';
import { createChangeStreamModelMock } from '../shared-kernel/testing/change-stream-model.mock';
import { DigestOutboxDispatcherService } from './digest-outbox-dispatcher.service';
import { PendingDigestDocument } from './pending-digest.schema';

function flushMicrotasks(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve));
}

describe('DigestOutboxDispatcherService', () => {
  it('dispatches a digest already pending at startup and deletes it', async () => {
    const { model, deleteOne } = createChangeStreamModelMock<PendingDigestDocument>([
      {
        date: '2026-08-10',
        eventId: 'event-10',
        payload: { adminEmail: 'admin@x.com', date: '2026-08-10', calls: [] },
      },
    ]);
    const rabbitMq = { publish: jest.fn().mockResolvedValue(undefined) } as unknown as RabbitMqConnectionService;
    const service = new DigestOutboxDispatcherService(model, rabbitMq);

    await service.onModuleInit();

    expect(rabbitMq.publish).toHaveBeenCalledWith(
      CALL_EVENTS_EXCHANGE,
      RoutingKey.DigestDue,
      { adminEmail: 'admin@x.com', date: '2026-08-10', calls: [], eventId: 'event-10' },
    );
    expect(deleteOne).toHaveBeenCalledWith({ date: '2026-08-10' });
  });

  it('dispatches a digest that arrives through the live change stream', async () => {
    const { model, deleteOne, emitChange } = createChangeStreamModelMock<PendingDigestDocument>([]);
    const rabbitMq = { publish: jest.fn().mockResolvedValue(undefined) } as unknown as RabbitMqConnectionService;
    const service = new DigestOutboxDispatcherService(model, rabbitMq);

    await service.onModuleInit();
    emitChange({
      fullDocument: {
        date: '2026-08-11',
        eventId: 'event-11',
        payload: { adminEmail: 'admin@x.com', date: '2026-08-11', calls: [] },
      },
    });
    await flushMicrotasks();

    expect(rabbitMq.publish).toHaveBeenCalledWith(
      CALL_EVENTS_EXCHANGE,
      RoutingKey.DigestDue,
      { adminEmail: 'admin@x.com', date: '2026-08-11', calls: [], eventId: 'event-11' },
    );
    expect(deleteOne).toHaveBeenCalledWith({ date: '2026-08-11' });
  });

  it('does not delete the pending digest if the broker publish fails', async () => {
    const { model, deleteOne } = createChangeStreamModelMock<PendingDigestDocument>([
      {
        date: '2026-08-10',
        eventId: 'event-10',
        payload: { adminEmail: 'admin@x.com', date: '2026-08-10', calls: [] },
      },
    ]);
    const rabbitMq = {
      publish: jest.fn().mockRejectedValue(new Error('broker nacked it')),
    } as unknown as RabbitMqConnectionService;
    const service = new DigestOutboxDispatcherService(model, rabbitMq);

    await service.onModuleInit();

    expect(deleteOne).not.toHaveBeenCalled();
  });

  it('isolates a publish failure to one digest during the startup sweep', async () => {
    const { model, deleteOne } = createChangeStreamModelMock<PendingDigestDocument>([
      {
        date: '2026-08-10',
        eventId: 'event-10',
        payload: { adminEmail: 'admin@x.com', date: '2026-08-10', calls: [] },
      },
      {
        date: '2026-08-11',
        eventId: 'event-11',
        payload: { adminEmail: 'admin@x.com', date: '2026-08-11', calls: [] },
      },
    ]);
    const publish = jest
      .fn()
      .mockRejectedValueOnce(new Error('channel closed'))
      .mockResolvedValueOnce(undefined);
    const rabbitMq = { publish } as unknown as RabbitMqConnectionService;
    const service = new DigestOutboxDispatcherService(model, rabbitMq);

    await service.onModuleInit();

    expect(publish).toHaveBeenCalledTimes(2);
    expect(deleteOne).toHaveBeenCalledTimes(1);
    expect(deleteOne).toHaveBeenCalledWith({ date: '2026-08-11' });
  });

  it('closes the change stream on module destroy', async () => {
    const { model, changeStream } = createChangeStreamModelMock<PendingDigestDocument>([]);
    const rabbitMq = { publish: jest.fn() } as unknown as RabbitMqConnectionService;
    const service = new DigestOutboxDispatcherService(model, rabbitMq);

    await service.onModuleInit();
    await service.onModuleDestroy();

    expect(changeStream.close).toHaveBeenCalled();
  });
});
