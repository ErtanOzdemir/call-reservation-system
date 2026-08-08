import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import configuration from '../config/configuration';
import { ConsumersModule } from '../consumers/consumers.module';
import { DigestModule } from '../digest/digest.module';
import { MongoConnectionModule } from '../shared-kernel/mongo-connection.module';
import { RabbitMqModule } from '../shared-kernel/rabbitmq/rabbitmq.module';
import { StateModule } from '../state/state.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      cache: true,
      envFilePath: 'apps/scheduler-service/.env',
      isGlobal: true,
      load: [configuration],
    }),
    ScheduleModule.forRoot(),
    MongoConnectionModule,
    RabbitMqModule,
    StateModule,
    ConsumersModule,
    DigestModule,
  ],
})
export class AppModule {}
