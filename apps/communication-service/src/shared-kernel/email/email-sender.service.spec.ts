import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Transporter } from 'nodemailer';
import {
  EmailSenderService,
  maskEmailAddress,
  sanitizeEmailContent,
} from './email-sender.service';

describe('EmailSenderService', () => {
  const email = {
    to: 'customer@example.com',
    subject: 'Sensitive subject',
    body: 'Sensitive email body',
  };

  it('sends a plain-text email through the configured SMTP transport', async () => {
    const sendMail = jest.fn().mockResolvedValue({ messageId: 'message-1' });
    const transporter = { sendMail } as unknown as Transporter;
    const configService = {
      getOrThrow: jest.fn().mockReturnValue('no-reply@example.com'),
    } as unknown as ConfigService;
    const service = new EmailSenderService(transporter, configService);

    await service.send(email);

    expect(sendMail).toHaveBeenCalledWith({
      from: 'no-reply@example.com',
      to: 'customer@example.com',
      subject: 'Sensitive subject',
      text: 'Sensitive email body',
    });
  });

  it('logs the subject and body without exposing full email addresses', async () => {
    const logSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation();
    const transporter = {
      sendMail: jest.fn().mockResolvedValue({ messageId: 'message-1' }),
    } as unknown as Transporter;
    const configService = {
      getOrThrow: jest.fn().mockReturnValue('no-reply@example.com'),
    } as unknown as ConfigService;
    const service = new EmailSenderService(transporter, configService);

    await service.send(email);

    const loggedValue = logSpy.mock.calls.flat().join(' ');
    expect(loggedValue).toContain('c***r@example.com');
    expect(loggedValue).not.toContain('customer@example.com');
    expect(loggedValue).toContain(email.subject);
    expect(loggedValue).toContain(email.body);
    logSpy.mockRestore();
  });

  it('does not expose SMTP error details in failure logs', async () => {
    const errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation();
    const transporter = {
      sendMail: jest
        .fn()
        .mockRejectedValue(
          new Error('Delivery failed for customer@example.com'),
        ),
    } as unknown as Transporter;
    const configService = {
      getOrThrow: jest.fn().mockReturnValue('no-reply@example.com'),
    } as unknown as ConfigService;
    const service = new EmailSenderService(transporter, configService);

    await expect(service.send(email)).rejects.toThrow('Delivery failed');

    const loggedValue = errorSpy.mock.calls.flat().join(' ');
    expect(loggedValue).toContain('c***r@example.com');
    expect(loggedValue).not.toContain('customer@example.com');
    expect(loggedValue).not.toContain('Delivery failed');
    errorSpy.mockRestore();
  });

  it('redacts malformed addresses', () => {
    expect(maskEmailAddress('not-an-email')).toBe('[redacted]');
  });

  it('masks every email address embedded in email content', () => {
    expect(
      sanitizeEmailContent(
        'Customer customer@example.com; admin admin@call-reservation.local.',
      ),
    ).toBe('Customer c***r@example.com; admin a***n@call-reservation.local.');
  });
});
