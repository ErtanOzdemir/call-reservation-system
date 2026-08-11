import { z } from 'zod';

const environmentSchema = z.object({
  MONGODB_URI: z.url(),
  RABBITMQ_URL: z.url(),
});

export default () => {
  const environment = environmentSchema.parse({
    MONGODB_URI: process.env.MONGODB_URI,
    RABBITMQ_URL: process.env.RABBITMQ_URL,
  });

  return {
    database: {
      uri: environment.MONGODB_URI,
    },
    rabbitmq: {
      url: environment.RABBITMQ_URL,
    },
  };
};
