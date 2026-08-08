import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import configuration from '../config/configuration';
import { AuthModule } from '../contexts/auth/auth.module';
import { AvailabilityModule } from '../contexts/availability/availability.module';
import { CallRequestModule } from '../contexts/call-request/call-request.module';
import { UserModule } from '../contexts/user/user.module';
import { MongoConnectionModule } from '../shared-kernel/mongo-connection.module';
import { RabbitMqModule } from '../shared-kernel/rabbitmq/rabbitmq.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      cache: true,
      envFilePath: 'apps/call-requests-service/.env',
      isGlobal: true,
      load: [configuration],
    }),
    MongoConnectionModule,
    RabbitMqModule,
    UserModule,
    AuthModule,
    CallRequestModule,
    AvailabilityModule,
  ],
})
export class AppModule {}
