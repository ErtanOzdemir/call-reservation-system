import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import configuration from '../config/configuration';
import { UserModule } from '../contexts/user/user.module';
import { MongoConnectionModule } from '../shared-kernel/mongo-connection.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';

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
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
