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
      JWT_SECRET: 'test-jwt-secret-that-is-at-least-32-characters',
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

  it('uses a one-hour JWT expiry by default', () => {
    delete process.env.JWT_EXPIRES_IN_SECONDS;

    expect(configuration().auth.jwtExpiresInSeconds).toBe(3600);
  });

  it('coerces the JWT expiry to a number', () => {
    process.env.JWT_EXPIRES_IN_SECONDS = '900';

    expect(configuration().auth.jwtExpiresInSeconds).toBe(900);
  });

  it('rejects a JWT secret shorter than 32 characters', () => {
    process.env.JWT_SECRET = 'too-short';

    expect(configuration).toThrow();
  });
});
