import configuration from './configuration';

describe('configuration', () => {
  const originalEnvironment = process.env;

  beforeEach(() => {
    process.env = {
      ...originalEnvironment,
      RABBITMQ_URL:
        'amqp://reservation:reservation@localhost:5672/call-reservation',
    };
  });

  afterEach(() => {
    process.env = originalEnvironment;
  });

  it('uses the default port when PORT is not set', () => {
    delete process.env.PORT;

    expect(configuration().app.port).toBe(3002);
  });

  it('coerces PORT to a number', () => {
    process.env.PORT = '3102';

    expect(configuration().app.port).toBe(3102);
  });

  it('rejects an invalid port', () => {
    process.env.PORT = '70000';

    expect(configuration).toThrow();
  });

  it('rejects a missing RabbitMQ URL', () => {
    delete process.env.RABBITMQ_URL;

    expect(configuration).toThrow();
  });
});
