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
});
