export class UserAlreadyExistsError extends Error {
  constructor() {
    super('A user with this email address already exists.');
    this.name = UserAlreadyExistsError.name;
  }
}
