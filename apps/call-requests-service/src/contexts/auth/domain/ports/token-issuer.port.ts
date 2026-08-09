import { AuthenticatedUser } from '@call-reservation/shared-types';

export const TOKEN_ISSUER = Symbol('TOKEN_ISSUER');

export interface TokenIssuerPort {
  issue(user: AuthenticatedUser): Promise<string>;
}
