import { CALL_EVENTS_EXCHANGE } from '@call-reservation/shared-types';
import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Channel, ChannelModel, connect } from 'amqplib';


export const REMINDER_DELAY_EXCHANGE = 'reminder.delay';
export const REMINDER_WAKEUP_ROUTING_KEY = 'reminder.wakeup';

@Injectable()
export class RabbitMqConnectionService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(RabbitMqConnectionService.name);
  private connection?: ChannelModel;
  private _channel?: Channel;

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit(): Promise<void> {
    const url = this.configService.getOrThrow<string>('rabbitmq.url');
    this.connection = await connect(url);
    this._channel = await this.connection.createChannel();

    await this._channel.assertExchange(CALL_EVENTS_EXCHANGE, 'topic', {
      durable: true,
    });
    await this._channel.assertExchange(
      REMINDER_DELAY_EXCHANGE,
      'x-delayed-message',
      { durable: true, arguments: { 'x-delayed-type': 'direct' } },
    );

    this.logger.log(
      `Connected to RabbitMQ; exchanges "${CALL_EVENTS_EXCHANGE}" and "${REMINDER_DELAY_EXCHANGE}" are ready.`,
    );
  }

  /** The open channel — queue/consumer setup is each consumer's own concern. */
  get channel(): Channel {
    if (!this._channel) {
      throw new Error('RabbitMQ channel is not initialized.');
    }

    return this._channel;
  }

  async onModuleDestroy(): Promise<void> {
    await this._channel?.close();
    await this.connection?.close();
  }
}
