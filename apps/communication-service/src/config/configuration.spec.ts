import configuration from './configuration';

describe('configuration', () => {
  const originalPort = process.env.PORT;

  afterEach(() => {
    if (originalPort === undefined) {
      delete process.env.PORT;
    } else {
      process.env.PORT = originalPort;
    }
  });

  it('uses the default port when PORT is not set', () => {
    delete process.env.PORT;

    expect(configuration()).toEqual({ app: { port: 3002 } });
  });

  it('coerces PORT to a number', () => {
    process.env.PORT = '3102';

    expect(configuration()).toEqual({ app: { port: 3102 } });
  });

  it('rejects an invalid port', () => {
    process.env.PORT = '70000';

    expect(configuration).toThrow();
  });
});
