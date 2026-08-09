import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CryptoModule } from '../../shared-kernel/crypto/crypto.module';
import { RegisterUserUseCaseHandler } from './application/register-user.use-case-handler';
import { USER_REPOSITORY } from './domain/ports/user-repository.port';
import { UsersController } from './infrastructure/http/users.controller';
import { UserRepositoryAdapter } from './infrastructure/mongo/user-repository.adapter';
import { UserRecord, UserSchema } from './infrastructure/mongo/user.schema';

@Module({
  imports: [
    CryptoModule,
    MongooseModule.forFeature([{ name: UserRecord.name, schema: UserSchema }]),
  ],
  controllers: [UsersController],
  providers: [
    RegisterUserUseCaseHandler,
    UserRepositoryAdapter,
    {
      provide: USER_REPOSITORY,
      useExisting: UserRepositoryAdapter,
    },
  ],
  exports: [USER_REPOSITORY],
})
export class UserModule {}
