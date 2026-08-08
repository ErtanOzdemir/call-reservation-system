import { RabbitMqConnectionService } from '../../../../shared-kernel/rabbitmq/rabbitmq-connection.service';
import { CallRequestDocument } from '../mongo/call-request.schema';
import { OutboxDispatcherService } from './outbox-dispatcher.service';

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

describe('OutboxDispatcherService', () => {
  const pendingEvent = {
    _id: 'event-1',
    routingKey: 'call.requested',
    payload: { requestId: 'req-1' },
    occurredAt: new Date(),
  };

  it('dispatches events already pending at startup and clears them', async () => {
    const model = createModelMock([{ id: 'req-1', pendingEvents: [pendingEvent] }]);
    const rabbitMq = { publish: jest.fn() } as unknown as RabbitMqConnectionService;
    const service = new OutboxDispatcherService(
      model as never as import('mongoose').Model<CallRequestDocument>,
      rabbitMq,
    );

    await service.onModuleInit();

    expect(rabbitMq.publish).toHaveBeenCalledWith('call.requested', {
      requestId: 'req-1',
    });
    expect(model.updateOne).toHaveBeenCalledWith(
      { id: 'req-1' },
      { $pull: { pendingEvents: { _id: pendingEvent._id } } },
    );
  });

  it('dispatches events that arrive through the live change stream', async () => {
    const model = createModelMock([]);
    const rabbitMq = { publish: jest.fn() } as unknown as RabbitMqConnectionService;
    const service = new OutboxDispatcherService(
      model as never as import('mongoose').Model<CallRequestDocument>,
      rabbitMq,
    );

    await service.onModuleInit();
    model.changeStreamListeners['change']({
      fullDocument: { id: 'req-2', pendingEvents: [pendingEvent] },
    });
    await flushMicrotasks();

    expect(rabbitMq.publish).toHaveBeenCalledWith('call.requested', {
      requestId: 'req-1',
    });
  });

  it('ignores change events with no full document', async () => {
    const model = createModelMock([]);
    const rabbitMq = { publish: jest.fn() } as unknown as RabbitMqConnectionService;
    const service = new OutboxDispatcherService(
      model as never as import('mongoose').Model<CallRequestDocument>,
      rabbitMq,
    );

    await service.onModuleInit();
    model.changeStreamListeners['change']({ fullDocument: undefined });
    await flushMicrotasks();

    expect(rabbitMq.publish).not.toHaveBeenCalled();
  });

  it('closes the change stream on module destroy', async () => {
    const model = createModelMock([]);
    const rabbitMq = { publish: jest.fn() } as unknown as RabbitMqConnectionService;
    const service = new OutboxDispatcherService(
      model as never as import('mongoose').Model<CallRequestDocument>,
      rabbitMq,
    );

    await service.onModuleInit();
    await service.onModuleDestroy();

    expect(model.changeStream.close).toHaveBeenCalled();
  });
});
