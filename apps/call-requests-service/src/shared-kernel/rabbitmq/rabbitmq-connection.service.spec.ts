import { CALL_EVENTS_EXCHANGE } from '@call-reservation/shared-types';
import { ConfigService } from '@nestjs/config';
import * as amqplib from 'amqplib';
import {
  MAX_PUBLISH_ATTEMPTS,
  RabbitMqConnectionService,
} from './rabbitmq-connection.service';

jest.mock('amqplib');

type PublishCallback = (error: Error | null) => void;

describe('RabbitMqConnectionService', () => {
  const channel = {
    assertExchange: jest.fn(),
    publish: jest.fn(
      (
        _exchange: string,
        _routingKey: string,
        _content: Buffer,
        _options: unknown,
        callback: PublishCallback,
      ) => callback(null),
    ),
    close: jest.fn(),
  };
  const connection = {
    createConfirmChannel: jest.fn(async () => channel),
    close: jest.fn(),
  };
  const configService = {
    getOrThrow: jest.fn((key: string) =>
      key === 'rabbitmq.url' ? 'amqp://localhost' : undefined,
    ),
  } as unknown as ConfigService;

  beforeEach(() => {
    jest.clearAllMocks();
    channel.publish.mockImplementation(
      (
        _exchange: string,
        _routingKey: string,
        _content: Buffer,
        _options: unknown,
        callback: PublishCallback,
      ) => callback(null),
    );
    (amqplib.connect as jest.Mock).mockResolvedValue(connection);
  });

  it('connects and declares the topic exchange on init', async () => {
    const service = new RabbitMqConnectionService(configService);

    await service.onModuleInit();

    expect(amqplib.connect).toHaveBeenCalledWith('amqp://localhost');
    expect(connection.createConfirmChannel).toHaveBeenCalled();
    expect(channel.assertExchange).toHaveBeenCalledWith(
      CALL_EVENTS_EXCHANGE,
      'topic',
      { durable: true },
    );
  });

  it('publishes a JSON payload to the exchange with the given routing key', async () => {
    const service = new RabbitMqConnectionService(configService);
    await service.onModuleInit();

    await service.publish('call.requested', { requestId: 'abc' });

    expect(channel.publish).toHaveBeenCalledWith(
      CALL_EVENTS_EXCHANGE,
      'call.requested',
      Buffer.from(JSON.stringify({ requestId: 'abc' })),
      { contentType: 'application/json', persistent: true },
      expect.any(Function),
    );
  });

  it('retries a publish the broker nacked and succeeds on a later attempt', async () => {
    const service = new RabbitMqConnectionService(configService);
    await service.onModuleInit();
    channel.publish
      .mockImplementationOnce(
        (
          _exchange: string,
          _routingKey: string,
          _content: Buffer,
          _options: unknown,
          callback: PublishCallback,
        ) => callback(new Error('channel closed')),
      )
      .mockImplementationOnce(
        (
          _exchange: string,
          _routingKey: string,
          _content: Buffer,
          _options: unknown,
          callback: PublishCallback,
        ) => callback(null),
      );

    await service.publish('call.requested', { requestId: 'abc' });

    expect(channel.publish).toHaveBeenCalledTimes(2);
  });

  it('gives up and throws after exhausting all retry attempts', async () => {
    const service = new RabbitMqConnectionService(configService);
    await service.onModuleInit();
    channel.publish.mockImplementation(
      (
        _exchange: string,
        _routingKey: string,
        _content: Buffer,
        _options: unknown,
        callback: PublishCallback,
      ) => callback(new Error('channel closed')),
    );

    await expect(
      service.publish('call.requested', { requestId: 'abc' }),
    ).rejects.toThrow('channel closed');
    expect(channel.publish).toHaveBeenCalledTimes(MAX_PUBLISH_ATTEMPTS);
  });

  it('throws if publish is called before the channel is initialized', async () => {
    const service = new RabbitMqConnectionService(configService);

    await expect(service.publish('call.requested', {})).rejects.toThrow(
      'RabbitMQ channel is not initialized.',
    );
  });

  it('closes the channel and connection on destroy', async () => {
    const service = new RabbitMqConnectionService(configService);
    await service.onModuleInit();

    await service.onModuleDestroy();

    expect(channel.close).toHaveBeenCalled();
    expect(connection.close).toHaveBeenCalled();
  });
});
