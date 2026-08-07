import { AuthenticatedUserDto } from '@call-reservation/shared-types';

export const TOKEN_ISSUER = Symbol('TOKEN_ISSUER');

export interface TokenIssuerPort {
  issue(user: AuthenticatedUserDto): Promise<string>;
}
