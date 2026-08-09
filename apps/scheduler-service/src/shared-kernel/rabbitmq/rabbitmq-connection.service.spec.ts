import { CALL_EVENTS_EXCHANGE } from '@call-reservation/shared-types';
import { ConfigService } from '@nestjs/config';
import * as amqplib from 'amqplib';
import {
  MAX_PUBLISH_ATTEMPTS,
  RabbitMqConnectionService,
  REMINDER_DELAY_EXCHANGE,
} from './rabbitmq-connection.service';

jest.mock('amqplib');

type PublishCallback = (error: Error | null) => void;

function ackImmediately(
  _exchange: string,
  _routingKey: string,
  _content: Buffer,
  _options: unknown,
  callback: PublishCallback,
): void {
  callback(null);
}

describe('RabbitMqConnectionService', () => {
  const channel = {
    assertExchange: jest.fn(),
    publish: jest.fn(ackImmediately),
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
    channel.publish.mockImplementation(ackImmediately);
    (amqplib.connect as jest.Mock).mockResolvedValue(connection);
  });

  it('connects and declares the shared topic exchange on init', async () => {
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

  it('declares its own delayed exchange for the 2-hours-before reminder', async () => {
    const service = new RabbitMqConnectionService(configService);

    await service.onModuleInit();

    expect(channel.assertExchange).toHaveBeenCalledWith(
      REMINDER_DELAY_EXCHANGE,
      'x-delayed-message',
      { durable: true, arguments: { 'x-delayed-type': 'direct' } },
    );
  });

  it('exposes the open channel once initialized', async () => {
    const service = new RabbitMqConnectionService(configService);
    await service.onModuleInit();

    expect(service.channel).toBe(channel);
  });

  it('throws if the channel is accessed before initialization', () => {
    const service = new RabbitMqConnectionService(configService);

    expect(() => service.channel).toThrow(
      'RabbitMQ channel is not initialized.',
    );
  });

  it('publishes a JSON payload and resolves once the broker confirms it', async () => {
    const service = new RabbitMqConnectionService(configService);
    await service.onModuleInit();

    await service.publish('some.exchange', 'some.routing-key', {
      requestId: 'abc',
    });

    expect(channel.publish).toHaveBeenCalledWith(
      'some.exchange',
      'some.routing-key',
      Buffer.from(JSON.stringify({ requestId: 'abc' })),
      { contentType: 'application/json', persistent: true },
      expect.any(Function),
    );
  });

  it('merges caller-supplied publish options (e.g. a delay header)', async () => {
    const service = new RabbitMqConnectionService(configService);
    await service.onModuleInit();

    await service.publish(
      REMINDER_DELAY_EXCHANGE,
      'reminder.wakeup',
      { requestId: 'abc' },
      { headers: { 'x-delay': 5000 } },
    );

    expect(channel.publish).toHaveBeenCalledWith(
      REMINDER_DELAY_EXCHANGE,
      'reminder.wakeup',
      Buffer.from(JSON.stringify({ requestId: 'abc' })),
      {
        contentType: 'application/json',
        persistent: true,
        headers: { 'x-delay': 5000 },
      },
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
      .mockImplementationOnce(ackImmediately);

    await service.publish('some.exchange', 'some.routing-key', {
      requestId: 'abc',
    });

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
      service.publish('some.exchange', 'some.routing-key', {
        requestId: 'abc',
      }),
    ).rejects.toThrow('channel closed');
    expect(channel.publish).toHaveBeenCalledTimes(MAX_PUBLISH_ATTEMPTS);
  });

  it('throws if publish is called before the channel is initialized', async () => {
    const service = new RabbitMqConnectionService(configService);

    await expect(
      service.publish('some.exchange', 'some.routing-key', {}),
    ).rejects.toThrow('RabbitMQ channel is not initialized.');
  });

  it('closes the channel and connection on destroy', async () => {
    const service = new RabbitMqConnectionService(configService);
    await service.onModuleInit();

    await service.onModuleDestroy();

    expect(channel.close).toHaveBeenCalled();
    expect(connection.close).toHaveBeenCalled();
  });
});
