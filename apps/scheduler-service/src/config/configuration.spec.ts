import configuration from './configuration';

describe('configuration', () => {
  const originalEnvironment = process.env;

  beforeEach(() => {
    process.env = {
      ...originalEnvironment,
      MONGODB_URI:
        'mongodb://localhost:27017/scheduler?replicaSet=rs0&directConnection=true',
      RABBITMQ_URL:
        'amqp://reservation:reservation@localhost:5672/call-reservation',
      ADMIN_EMAIL: 'admin@call-reservation.local',
    };
  });

  afterEach(() => {
    process.env = originalEnvironment;
  });

  it('uses the default port when PORT is not set', () => {
    delete process.env.PORT;

    expect(configuration().app.port).toBe(3003);
  });

  it('coerces PORT to a number', () => {
    process.env.PORT = '3103';

    expect(configuration().app.port).toBe(3103);
  });

  it('rejects an invalid port', () => {
    process.env.PORT = '70000';

    expect(configuration).toThrow();
  });

  it('rejects a missing MongoDB URL', () => {
    delete process.env.MONGODB_URI;

    expect(configuration).toThrow();
  });

  it('rejects a missing RabbitMQ URL', () => {
    delete process.env.RABBITMQ_URL;

    expect(configuration).toThrow();
  });

  it('rejects a missing admin email', () => {
    delete process.env.ADMIN_EMAIL;

    expect(configuration).toThrow();
  });

  it('rejects an invalid admin email', () => {
    process.env.ADMIN_EMAIL = 'not-an-email';

    expect(configuration).toThrow();
  });

  it('exposes the admin email for the reminder/digest emails', () => {
    expect(configuration().reminder.adminEmail).toBe(
      'admin@call-reservation.local',
    );
  });
});
