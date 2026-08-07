import { z } from 'zod';

const environmentSchema = z.object({
  PORT: z.coerce.number().int().min(1).max(65535).default(3001),
  MONGODB_URI: z.url(),
  RABBITMQ_URL: z.url(),
  JWT_SECRET: z.string().min(32),
  JWT_EXPIRES_IN_SECONDS: z.coerce.number().int().positive().default(3600),
});

export default () => {
  const environment = environmentSchema.parse({
    PORT: process.env.PORT,
    MONGODB_URI: process.env.MONGODB_URI,
    RABBITMQ_URL: process.env.RABBITMQ_URL,
    JWT_SECRET: process.env.JWT_SECRET,
    JWT_EXPIRES_IN_SECONDS: process.env.JWT_EXPIRES_IN_SECONDS,
  });

  return {
    app: {
      port: environment.PORT,
    },
    database: {
      uri: environment.MONGODB_URI,
    },
    rabbitmq: {
      url: environment.RABBITMQ_URL,
    },
    auth: {
      jwtSecret: environment.JWT_SECRET,
      jwtExpiresInSeconds: environment.JWT_EXPIRES_IN_SECONDS,
    },
  };
};
