import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app/app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);
  const globalPrefix = 'call-request-service';

  app.useGlobalPipes(
    new ValidationPipe({
      forbidNonWhitelisted: true,
      transform: true,
      whitelist: true,
    }),
  );
  app.enableCors({
    origin: configService.getOrThrow<string>('app.corsOrigin'),
  });
  app.setGlobalPrefix(globalPrefix);
  const port = configService.getOrThrow<number>('app.port');
  await app.listen(port);
  Logger.log(
    `🚀 Call Request Service is running on: http://localhost:${port}/${globalPrefix}`,
  );
}

bootstrap();
