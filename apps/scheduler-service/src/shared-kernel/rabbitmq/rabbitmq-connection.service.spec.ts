import { CALL_EVENTS_EXCHANGE } from '@call-reservation/shared-types';
import { ConfigService } from '@nestjs/config';
import * as amqplib from 'amqplib';
import {
  RabbitMqConnectionService,
  REMINDER_DELAY_EXCHANGE,
} from './rabbitmq-connection.service';

jest.mock('amqplib');

describe('RabbitMqConnectionService', () => {
  const channel = {
    assertExchange: jest.fn(),
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

  it('connects and declares the shared topic exchange on init', async () => {
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

  it('closes the channel and connection on destroy', async () => {
    const service = new RabbitMqConnectionService(configService);
    await service.onModuleInit();

    await service.onModuleDestroy();

    expect(channel.close).toHaveBeenCalled();
    expect(connection.close).toHaveBeenCalled();
  });
});
