import { CALL_EVENTS_EXCHANGE } from '@call-reservation/shared-types';
import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ChannelModel, ConfirmChannel, connect, Options } from 'amqplib';

export const REMINDER_DELAY_EXCHANGE = 'reminder.delay';
export const REMINDER_WAKEUP_ROUTING_KEY = 'reminder.wakeup';

export const MAX_PUBLISH_ATTEMPTS = 3;
const RETRY_BASE_DELAY_MS = 200;

@Injectable()
export class RabbitMqConnectionService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(RabbitMqConnectionService.name);
  private connection?: ChannelModel;
  private _channel?: ConfirmChannel;

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit(): Promise<void> {
    const url = this.configService.getOrThrow<string>('rabbitmq.url');
    this.connection = await connect(url);
    this._channel = await this.connection.createConfirmChannel();

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
  get channel(): ConfirmChannel {
    if (!this._channel) {
      throw new Error('RabbitMQ channel is not initialized.');
    }

    return this._channel;
  }

  async publish(
    exchange: string,
    routingKey: string,
    payload: Record<string, unknown>,
    options?: Options.Publish,
    attempt = 1,
  ): Promise<void> {
    try {
      await this.publishWithConfirm(exchange, routingKey, payload, options);
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
      await this.publish(exchange, routingKey, payload, options, attempt + 1);
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this._channel?.close();
    await this.connection?.close();
  }

  private publishWithConfirm(
    exchange: string,
    routingKey: string,
    payload: Record<string, unknown>,
    options?: Options.Publish,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      this.channel.publish(
        exchange,
        routingKey,
        Buffer.from(JSON.stringify(payload)),
        { contentType: 'application/json', persistent: true, ...options },
        (error) => (error ? reject(error) : resolve()),
      );
    });
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
