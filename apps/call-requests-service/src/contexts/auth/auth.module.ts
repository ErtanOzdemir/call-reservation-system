import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { CryptoModule } from '../../shared-kernel/crypto/crypto.module';
import { UserModule } from '../user/user.module';
import { LoginUseCaseHandler } from './application/login.use-case-handler';
import { TOKEN_ISSUER } from './domain/ports/token-issuer.port';
import { AuthController } from './infrastructure/http/auth.controller';
import { JwtAuthGuard } from './infrastructure/http/guards/jwt-auth.guard';
import { RolesGuard } from './infrastructure/http/guards/roles.guard';
import { JwtTokenIssuerAdapter } from './infrastructure/jwt/jwt-token-issuer.adapter';

@Global()
@Module({
  imports: [
    UserModule,
    CryptoModule,
    JwtModule.registerAsync({
      global: true,
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.getOrThrow<string>('auth.jwtSecret'),
        signOptions: {
          algorithm: 'HS256' as const,
          expiresIn: configService.getOrThrow<number>(
            'auth.jwtExpiresInSeconds',
          ),
        },
        verifyOptions: {
          algorithms: ['HS256' as const],
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    LoginUseCaseHandler,
    JwtTokenIssuerAdapter,
    JwtAuthGuard,
    RolesGuard,
    {
      provide: TOKEN_ISSUER,
      useExisting: JwtTokenIssuerAdapter,
    },
  ],
  exports: [JwtAuthGuard, RolesGuard],
})
export class AuthModule {}
