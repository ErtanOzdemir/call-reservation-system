import { PasswordHasherService } from '../password-hasher.service';

/**
 * Deterministic stand-in for bcrypt: hash(password) => `hashed:${password}`,
 * and compare matches against that same convention. Records every call so
 * tests can assert on hashCalls/compareCalls directly instead of needing a
 * mocking framework.
 */
export class MockPasswordHasherService extends PasswordHasherService {
  hashCalls: string[] = [];
  compareCalls: Array<{ password: string; passwordHash: string }> = [];

  async hash(password: string): Promise<string> {
    this.hashCalls.push(password);
    return `hashed:${password}`;
  }

  async compare(password: string, passwordHash: string): Promise<boolean> {
    this.compareCalls.push({ password, passwordHash });
    return passwordHash === `hashed:${password}`;
  }
}
