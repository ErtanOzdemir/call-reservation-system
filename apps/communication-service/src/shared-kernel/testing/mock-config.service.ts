import { ConfigService } from '@nestjs/config';

export function createMockConfigService(
  values: Record<string, unknown>,
): ConfigService {
  return {
    getOrThrow: (key: string) => {
      if (!(key in values)) {
        throw new Error(`Config key "${key}" was not seeded in the mock ConfigService.`);
      }
      return values[key];
    },
  } as unknown as ConfigService;
}
