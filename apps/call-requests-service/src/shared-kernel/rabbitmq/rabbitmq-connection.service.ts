import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Channel, ChannelModel, connect } from 'amqplib';

export const CALL_EVENTS_EXCHANGE = 'call.events';

@Injectable()
export class RabbitMqConnectionService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(RabbitMqConnectionService.name);
  private connection?: ChannelModel;
  private channel?: Channel;

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit(): Promise<void> {
    const url = this.configService.getOrThrow<string>('rabbitmq.url');
    this.connection = await connect(url);
    this.channel = await this.connection.createChannel();
    await this.channel.assertExchange(CALL_EVENTS_EXCHANGE, 'topic', {
      durable: true,
    });
    this.logger.log(
      `Connected to RabbitMQ; exchange "${CALL_EVENTS_EXCHANGE}" is ready.`,
    );
  }

  publish(routingKey: string, payload: Record<string, unknown>): void {
    if (!this.channel) {
      throw new Error('RabbitMQ channel is not initialized.');
    }

    this.channel.publish(
      CALL_EVENTS_EXCHANGE,
      routingKey,
      Buffer.from(JSON.stringify(payload)),
      { contentType: 'application/json', persistent: true },
    );
  }

  async onModuleDestroy(): Promise<void> {
    await this.channel?.close();
    await this.connection?.close();
  }
}
