import { RabbitMqConnectionService } from '../../../../shared-kernel/rabbitmq/rabbitmq-connection.service';
import { CallRequestDocument } from '../mongo/call-request.schema';
import { createChangeStreamModelMock } from './testing/change-stream-model.mock';
import { OutboxDispatcherService } from './outbox-dispatcher.service';

function flushMicrotasks(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve));
}

describe('OutboxDispatcherService', () => {
  const pendingEvent = {
    _id: 'event-1',
    routingKey: 'call.requested',
    payload: { requestId: 'req-1' },
    occurredAt: new Date(),
  };

  it('dispatches events already pending at startup and clears them', async () => {
    const { model, updateOne } = createChangeStreamModelMock<CallRequestDocument>([
      { id: 'req-1', pendingEvents: [pendingEvent] },
    ]);
    const rabbitMq = { publish: jest.fn() } as unknown as RabbitMqConnectionService;
    const service = new OutboxDispatcherService(model, rabbitMq);

    await service.onModuleInit();

    expect(rabbitMq.publish).toHaveBeenCalledWith('call.requested', {
      requestId: 'req-1',
    });
    expect(updateOne).toHaveBeenCalledWith(
      { id: 'req-1' },
      { $pull: { pendingEvents: { _id: pendingEvent._id } } },
    );
  });

  it('dispatches events that arrive through the live change stream', async () => {
    const { model, emitChange } = createChangeStreamModelMock<CallRequestDocument>([]);
    const rabbitMq = { publish: jest.fn() } as unknown as RabbitMqConnectionService;
    const service = new OutboxDispatcherService(model, rabbitMq);

    await service.onModuleInit();
    emitChange({
      fullDocument: { id: 'req-2', pendingEvents: [pendingEvent] },
    });
    await flushMicrotasks();

    expect(rabbitMq.publish).toHaveBeenCalledWith('call.requested', {
      requestId: 'req-1',
    });
  });

  it('ignores change events with no full document', async () => {
    const { model, emitChange } = createChangeStreamModelMock<CallRequestDocument>([]);
    const rabbitMq = { publish: jest.fn() } as unknown as RabbitMqConnectionService;
    const service = new OutboxDispatcherService(model, rabbitMq);

    await service.onModuleInit();
    emitChange({ fullDocument: undefined });
    await flushMicrotasks();

    expect(rabbitMq.publish).not.toHaveBeenCalled();
  });

  it('closes the change stream on module destroy', async () => {
    const { model, changeStream } = createChangeStreamModelMock<CallRequestDocument>([]);
    const rabbitMq = { publish: jest.fn() } as unknown as RabbitMqConnectionService;
    const service = new OutboxDispatcherService(model, rabbitMq);

    await service.onModuleInit();
    await service.onModuleDestroy();

    expect(changeStream.close).toHaveBeenCalled();
  });
});
