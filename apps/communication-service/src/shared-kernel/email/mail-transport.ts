export interface SendMailArgs {
  from: string;
  to: string;
  subject: string;
  text: string;
}

export interface MailTransport {
  sendMail(args: SendMailArgs): Promise<{ messageId: string }>;
}
