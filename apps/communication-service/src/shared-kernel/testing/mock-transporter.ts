import {
  MailTransport,
  SendMailArgs,
} from '../email/mail-transport';

export class MockTransporter implements MailTransport {
  sendMailCalls: SendMailArgs[] = [];
  messageId = 'mock-message-id';
  failure: Error | null = null;

  async sendMail(args: SendMailArgs): Promise<{ messageId: string }> {
    this.sendMailCalls.push(args);

    if (this.failure) {
      throw this.failure;
    }

    return { messageId: this.messageId };
  }
}
