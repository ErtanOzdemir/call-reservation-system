import { z } from 'zod';

const environmentSchema = z.object({
  PORT: z.coerce.number().int().min(1).max(65535).default(3002),
  RABBITMQ_URL: z.url(),
});

export default () => {
  const environment = environmentSchema.parse({
    PORT: process.env.PORT,
    RABBITMQ_URL: process.env.RABBITMQ_URL,
  });

  return {
    app: {
      port: environment.PORT,
    },
    rabbitmq: {
      url: environment.RABBITMQ_URL,
    },
  };
};
