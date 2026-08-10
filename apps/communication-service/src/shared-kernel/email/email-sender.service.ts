import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EMAIL_TRANSPORT } from './email.constants';
import { EmailMessage } from './email-message';
import { MailTransport } from './mail-transport';

export function maskEmailAddress(email: string): string {
  const separatorIndex = email.lastIndexOf('@');

  if (separatorIndex <= 0 || separatorIndex === email.length - 1) {
    return '[redacted]';
  }

  const localPart = email.slice(0, separatorIndex);
  const domain = email.slice(separatorIndex + 1);
  const visibleLocalPart =
    localPart.length === 1
      ? '*'
      : `${localPart[0]}***${localPart[localPart.length - 1]}`;

  return `${visibleLocalPart}@${domain}`;
}

export function sanitizeEmailContent(content: string): string {
  return content.replace(
    /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi,
    (emailAddress) => maskEmailAddress(emailAddress),
  );
}

@Injectable()
export class EmailSenderService {
  private readonly logger = new Logger(EmailSenderService.name);

  constructor(
    @Inject(EMAIL_TRANSPORT) private readonly transporter: MailTransport,
    private readonly configService: ConfigService,
  ) {}

  async send(email: EmailMessage): Promise<void> {
    const maskedRecipient = maskEmailAddress(email.to);

    try {
      const result = await this.transporter.sendMail({
        from: this.configService.getOrThrow<string>('smtp.from'),
        to: email.to,
        subject: email.subject,
        text: email.body,
      });

      this.logger.log(
        `Email accepted by SMTP: ${JSON.stringify({
          recipient: maskedRecipient,
          messageId: result.messageId,
          subject: sanitizeEmailContent(email.subject),
          body: sanitizeEmailContent(email.body),
        })}`,
      );
    } catch (error: unknown) {
      this.logger.error(`SMTP delivery failed for ${maskedRecipient}.`);
      throw error;
    }
  }
}
