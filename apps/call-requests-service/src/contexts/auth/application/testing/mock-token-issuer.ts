import { AuthenticatedUser } from '@call-reservation/shared-types';
import { TokenIssuerPort } from '../../domain/ports/token-issuer.port';

export const MOCK_ISSUED_TOKEN = 'signed-token';

export class MockTokenIssuer implements TokenIssuerPort {
  issuedFor: AuthenticatedUser[] = [];

  async issue(user: AuthenticatedUser): Promise<string> {
    this.issuedFor.push(user);
    return MOCK_ISSUED_TOKEN;
  }
}
