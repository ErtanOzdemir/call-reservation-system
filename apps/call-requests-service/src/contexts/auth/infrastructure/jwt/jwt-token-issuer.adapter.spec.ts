import { Role } from '@call-reservation/shared-types';
import { JwtService } from '@nestjs/jwt';
import { JwtTokenIssuerAdapter } from './jwt-token-issuer.adapter';

describe('JwtTokenIssuerAdapter', () => {
  const secret = 'test-jwt-secret-that-is-at-least-32-characters';
  const jwtService = new JwtService({
    secret,
    signOptions: { algorithm: 'HS256', expiresIn: 3600 },
    verifyOptions: { algorithms: ['HS256'] },
  });
  const adapter = new JwtTokenIssuerAdapter(jwtService);

  it('issues a signed token containing only identity claims', async () => {
    const token = await adapter.issue({
      id: 'user-id',
      email: 'person@example.com',
      role: Role.USER,
    });
    const payload = await jwtService.verifyAsync(token);

    expect(payload).toEqual(
      expect.objectContaining({
        sub: 'user-id',
        email: 'person@example.com',
        role: Role.USER,
      }),
    );
    expect(payload).not.toHaveProperty('passwordHash');
    expect(payload.exp - payload.iat).toBe(3600);
  });
});
