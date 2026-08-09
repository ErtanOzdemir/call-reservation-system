import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { EMAIL_TRANSPORT } from './email.constants';
import { EmailSenderService } from './email-sender.service';

@Module({
  providers: [
    {
      provide: EMAIL_TRANSPORT,
      inject: [ConfigService],
      useFactory: (configService: ConfigService) =>
        nodemailer.createTransport({
          host: configService.getOrThrow<string>('smtp.host'),
          port: configService.getOrThrow<number>('smtp.port'),
          secure: configService.getOrThrow<boolean>('smtp.secure'),
        }),
    },
    EmailSenderService,
  ],
  exports: [EmailSenderService],
})
export class EmailModule {}
