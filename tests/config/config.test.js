const { loadConfig, resolveOrigins, ConfigurationError } = require('../../src/shared/config');
const { startServer } = require('../../src/shared/runtime/start-server');

const valid = Object.freeze({
  NODE_ENV: 'development', PORT: '5000', MONGO_URI: 'mongodb://localhost:27017/ecommerce',
  JWT_SECRET: 'local-only-key', FRONTEND_URL: 'http://localhost:3000',
});

describe('environment validation', () => {
  test('development accepts a complete minimum configuration', () => {
    expect(loadConfig(valid)).toMatchObject({ port: 5000, mongoUri: valid.MONGO_URI });
  });
  test('test mode permits fixture-only environment', () => {
    expect(loadConfig({ NODE_ENV: 'test' }).nodeEnv).toBe('test');
  });
  test.each([
    [{ ...valid, PORT: '0' }, 'PORT'],
    [{ ...valid, MONGO_URI: 'not-a-uri' }, 'MONGO_URI'],
    [{ ...valid, JWT_SECRET: '' }, 'JWT_SECRET'],
    [{ ...valid, FRONTEND_URL: '*' }, 'FRONTEND_URL'],
    [{ ...valid, FRONTEND_URL: 'https://example.com/path' }, 'FRONTEND_URL'],
    [{ ...valid, AWS_REGION: 'us-east-1' }, 'AWS S3'],
    [{ ...valid, EMAIL_USER: 'test@example.com' }, 'email'],
    [{ ...valid, NODE_ENV: 'production', FRONTEND_URL: 'http://example.com', JWT_SECRET: 'x'.repeat(32) }, 'HTTPS'],
  ])('rejects invalid config: %s', (input, expected) => {
    expect(() => loadConfig(input)).toThrow(ConfigurationError);
    expect(() => loadConfig(input)).toThrow(expected);
  });
  test('production requires strong JWT, S3, email, and frontend origin', () => {
    expect(() => loadConfig({ ...valid, NODE_ENV: 'production' })).toThrow('JWT_SECRET');
  });
  test('allows only explicit configured frontend origins in production', () => {
    expect(resolveOrigins({ NODE_ENV: 'production', FRONTEND_URL: 'https://web.example.com' }))
      .toEqual(['https://web.example.com']);
  });
});

describe('startup database readiness', () => {
  test('listens only after successful database connection', async () => {
    const calls = [];
    await startServer({ config: { mongoUri: 'test-mongo', port: 5000 },
      connect: async () => { calls.push('connect'); },
      listen: async () => { calls.push('listen'); },
    });
    expect(calls).toEqual(['connect', 'listen']);
  });
  test('never listens after connection failure', async () => {
    const listen = jest.fn();
    await expect(startServer({ config: { mongoUri: 'test-mongo', port: 5000 },
      connect: async () => { throw new Error('db unavailable'); }, listen,
    })).rejects.toThrow('db unavailable');
    expect(listen).not.toHaveBeenCalled();
  });
});
