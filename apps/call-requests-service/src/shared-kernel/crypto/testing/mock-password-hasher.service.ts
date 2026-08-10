import { PasswordHasherService } from '../password-hasher.service';

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
