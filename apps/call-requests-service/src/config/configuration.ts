import { z } from 'zod';

const environmentSchema = z.object({
  PORT: z.coerce.number().int().min(1).max(65535).default(3001),
  MONGODB_URI: z.url(),
  RABBITMQ_URL: z.url(),
});

export default () => {
  const environment = environmentSchema.parse({
    PORT: process.env.PORT,
    MONGODB_URI: process.env.MONGODB_URI,
    RABBITMQ_URL: process.env.RABBITMQ_URL,
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
  };
};
