import { ConfigService } from '@nestjs/config';
import * as amqplib from 'amqplib';
import {
  CALL_EVENTS_EXCHANGE,
  RabbitMqConnectionService,
} from './rabbitmq-connection.service';

jest.mock('amqplib');

describe('RabbitMqConnectionService', () => {
  const channel = {
    assertExchange: jest.fn(),
    publish: jest.fn(),
    close: jest.fn(),
  };
  const connection = {
    createChannel: jest.fn(async () => channel),
    close: jest.fn(),
  };
  const configService = {
    getOrThrow: jest.fn((key: string) =>
      key === 'rabbitmq.url' ? 'amqp://localhost' : undefined,
    ),
  } as unknown as ConfigService;

  beforeEach(() => {
    jest.clearAllMocks();
    (amqplib.connect as jest.Mock).mockResolvedValue(connection);
  });

  it('connects and declares the topic exchange on init', async () => {
    const service = new RabbitMqConnectionService(configService);

    await service.onModuleInit();

    expect(amqplib.connect).toHaveBeenCalledWith('amqp://localhost');
    expect(connection.createChannel).toHaveBeenCalled();
    expect(channel.assertExchange).toHaveBeenCalledWith(
      CALL_EVENTS_EXCHANGE,
      'topic',
      { durable: true },
    );
  });

  it('publishes a JSON payload to the exchange with the given routing key', async () => {
    const service = new RabbitMqConnectionService(configService);
    await service.onModuleInit();

    service.publish('call.requested', { requestId: 'abc' });

    expect(channel.publish).toHaveBeenCalledWith(
      CALL_EVENTS_EXCHANGE,
      'call.requested',
      Buffer.from(JSON.stringify({ requestId: 'abc' })),
      { contentType: 'application/json', persistent: true },
    );
  });

  it('throws if publish is called before the channel is initialized', () => {
    const service = new RabbitMqConnectionService(configService);

    expect(() => service.publish('call.requested', {})).toThrow(
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
