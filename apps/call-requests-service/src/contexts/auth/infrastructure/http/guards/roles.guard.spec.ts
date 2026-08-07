import { Role } from '@call-reservation/shared-types';
import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard';

describe('RolesGuard', () => {
  const reflector = {
    getAllAndOverride: jest.fn(),
  } as unknown as Reflector;
  const request = { user: { role: Role.USER } };
  const context = {
    getHandler: jest.fn(),
    getClass: jest.fn(),
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
  const guard = new RolesGuard(reflector);

  beforeEach(() => {
    jest.clearAllMocks();
    request.user.role = Role.USER;
  });

  it('allows a role listed in route metadata', () => {
    jest.mocked(reflector.getAllAndOverride).mockReturnValue([Role.USER]);

    expect(guard.canActivate(context)).toBe(true);
  });

  it('rejects a role not listed in route metadata', () => {
    jest.mocked(reflector.getAllAndOverride).mockReturnValue([Role.ADMIN]);

    expect(guard.canActivate(context)).toBe(false);
  });

  it('allows routes without role metadata', () => {
    jest.mocked(reflector.getAllAndOverride).mockReturnValue(undefined);

    expect(guard.canActivate(context)).toBe(true);
  });
});
