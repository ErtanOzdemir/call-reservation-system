import { z } from 'zod';

const environmentSchema = z.object({
  PORT: z.coerce.number().int().min(1).max(65535).default(3001),
});

export default () => {
  const environment = environmentSchema.parse({
    PORT: process.env.PORT,
  });

  return {
    app: {
      port: environment.PORT,
    },
  };
};
