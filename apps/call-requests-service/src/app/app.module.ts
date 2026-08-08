import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import configuration from '../config/configuration';
import { AuthModule } from '../contexts/auth/auth.module';
import { CallRequestModule } from '../contexts/call-request/call-request.module';
import { UserModule } from '../contexts/user/user.module';
import { MongoConnectionModule } from '../shared-kernel/mongo-connection.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      cache: true,
      envFilePath: 'apps/call-requests-service/.env',
      isGlobal: true,
      load: [configuration],
    }),
    MongoConnectionModule,
    UserModule,
    AuthModule,
    CallRequestModule,
  ],
})
export class AppModule {}
