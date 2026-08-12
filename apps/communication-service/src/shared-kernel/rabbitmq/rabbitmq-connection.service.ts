import { CALL_EVENTS_EXCHANGE } from '@call-reservation/shared-types';
import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Channel, ChannelModel, connect } from 'amqplib';

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
    this.logger.log(
      `Connected to RabbitMQ; exchange "${CALL_EVENTS_EXCHANGE}" is ready.`,
    );
  }

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
