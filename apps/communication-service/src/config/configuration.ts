import { z } from 'zod';

const environmentSchema = z.object({
  PORT: z.coerce.number().int().min(1).max(65535).default(3002),
  MONGODB_URI: z.url(),
  RABBITMQ_URL: z.url(),
  SMTP_HOST: z.string().min(1).default('localhost'),
  SMTP_PORT: z.coerce.number().int().min(1).max(65535).default(1025),
  SMTP_SECURE: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),
  SMTP_FROM: z.string().min(1).default('no-reply@call-reservation.local'),
});

export default () => {
  const environment = environmentSchema.parse({
    PORT: process.env.PORT,
    MONGODB_URI: process.env.MONGODB_URI,
    RABBITMQ_URL: process.env.RABBITMQ_URL,
    SMTP_HOST: process.env.SMTP_HOST,
    SMTP_PORT: process.env.SMTP_PORT,
    SMTP_SECURE: process.env.SMTP_SECURE,
    SMTP_FROM: process.env.SMTP_FROM,
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
    smtp: {
      host: environment.SMTP_HOST,
      port: environment.SMTP_PORT,
      secure: environment.SMTP_SECURE,
      from: environment.SMTP_FROM,
    },
  };
};
