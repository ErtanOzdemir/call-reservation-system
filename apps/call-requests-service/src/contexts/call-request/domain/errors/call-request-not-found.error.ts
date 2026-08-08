export class CallRequestNotFoundError extends Error {
  constructor(id: string) {
    super(`No call request found with id "${id}".`);
    this.name = CallRequestNotFoundError.name;
  }
}
