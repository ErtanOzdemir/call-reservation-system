import configuration from './configuration';

describe('configuration', () => {
  const originalEnvironment = process.env;

  beforeEach(() => {
    process.env = {
      ...originalEnvironment,
      MONGODB_URI:
        'mongodb://localhost:27017/call_requests?replicaSet=rs0&directConnection=true',
      RABBITMQ_URL:
        'amqp://reservation:reservation@localhost:5672/call-reservation',
    };
  });

  afterEach(() => {
    process.env = originalEnvironment;
  });

  it('uses the default port when PORT is not set', () => {
    delete process.env.PORT;

    expect(configuration().app.port).toBe(3001);
  });

  it('coerces PORT to a number', () => {
    process.env.PORT = '3101';

    expect(configuration().app.port).toBe(3101);
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
});
