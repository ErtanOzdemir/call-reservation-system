import configuration from './configuration';

describe('configuration', () => {
  const originalEnvironment = process.env;

  beforeEach(() => {
    process.env = {
      ...originalEnvironment,
      MONGODB_URI:
        'mongodb://localhost:27017/communication?replicaSet=rs0&directConnection=true',
      RABBITMQ_URL:
        'amqp://reservation:reservation@localhost:5672/call-reservation',
      SMTP_HOST: 'localhost',
      SMTP_PORT: '1025',
      SMTP_SECURE: 'false',
      SMTP_FROM: 'no-reply@call-reservation.local',
    };
  });

  afterEach(() => {
    process.env = originalEnvironment;
  });

  it('rejects a missing MongoDB URL', () => {
    delete process.env.MONGODB_URI;

    expect(configuration).toThrow();
  });

  it('rejects a missing RabbitMQ URL', () => {
    delete process.env.RABBITMQ_URL;

    expect(configuration).toThrow();
  });

  it('uses MailHog-compatible SMTP defaults', () => {
    delete process.env.SMTP_HOST;
    delete process.env.SMTP_PORT;
    delete process.env.SMTP_SECURE;
    delete process.env.SMTP_FROM;

    expect(configuration().smtp).toEqual({
      host: 'localhost',
      port: 1025,
      secure: false,
      from: 'no-reply@call-reservation.local',
    });
  });

  it('coerces SMTP settings', () => {
    process.env.SMTP_HOST = 'smtp.example.com';
    process.env.SMTP_PORT = '465';
    process.env.SMTP_SECURE = 'true';
    process.env.SMTP_FROM = 'notifications@example.com';

    expect(configuration().smtp).toEqual({
      host: 'smtp.example.com',
      port: 465,
      secure: true,
      from: 'notifications@example.com',
    });
  });
});
