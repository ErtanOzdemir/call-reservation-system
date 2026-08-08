import { CALL_EVENTS_EXCHANGE } from '@call-reservation/shared-types';
import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Channel, ChannelModel, connect } from 'amqplib';

export const MAX_PUBLISH_ATTEMPTS = 3;
const RETRY_BASE_DELAY_MS = 200;

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

  async publish(
    routingKey: string,
    payload: Record<string, unknown>,
    attempt = 1,
  ): Promise<void> {
    if (!this.channel) {
      throw new Error('RabbitMQ channel is not initialized.');
    }

    try {
      this.channel.publish(
        CALL_EVENTS_EXCHANGE,
        routingKey,
        Buffer.from(JSON.stringify(payload)),
        { contentType: 'application/json', persistent: true },
      );
    } catch (error) {
      if (attempt >= MAX_PUBLISH_ATTEMPTS) {
        this.logger.error(
          `Failed to publish "${routingKey}" after ${attempt} attempts.`,
          error,
        );
        throw error;
      }

      this.logger.warn(
        `Publish attempt ${attempt} for "${routingKey}" failed, retrying...`,
        error,
      );
      await this.delay(RETRY_BASE_DELAY_MS * attempt);
      await this.publish(routingKey, payload, attempt + 1);
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.channel?.close();
    await this.connection?.close();
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
