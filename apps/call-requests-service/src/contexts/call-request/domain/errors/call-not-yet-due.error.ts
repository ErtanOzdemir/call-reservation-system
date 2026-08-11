export class CallNotYetDueError extends Error {
  constructor() {
    super('This call cannot be marked as called before its scheduled time.');
    this.name = CallNotYetDueError.name;
  }
}
