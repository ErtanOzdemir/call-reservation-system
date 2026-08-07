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

    expect(configuration()).toEqual({ app: { port: 3003 } });
  });

  it('coerces PORT to a number', () => {
    process.env.PORT = '3103';

    expect(configuration()).toEqual({ app: { port: 3103 } });
  });

  it('rejects an invalid port', () => {
    process.env.PORT = '70000';

    expect(configuration).toThrow();
  });
});
