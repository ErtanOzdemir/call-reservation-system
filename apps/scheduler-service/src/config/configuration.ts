import { z } from 'zod';

const environmentSchema = z.object({
  PORT: z.coerce.number().int().min(1).max(65535).default(3003),
  MONGODB_URI: z.url(),
  RABBITMQ_URL: z.url(),
  ADMIN_EMAIL: z.email(),
});

export default () => {
  const environment = environmentSchema.parse({
    PORT: process.env.PORT,
    MONGODB_URI: process.env.MONGODB_URI,
    RABBITMQ_URL: process.env.RABBITMQ_URL,
    ADMIN_EMAIL: process.env.ADMIN_EMAIL,
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
    reminder: {
      adminEmail: environment.ADMIN_EMAIL,
    },
  };
};
