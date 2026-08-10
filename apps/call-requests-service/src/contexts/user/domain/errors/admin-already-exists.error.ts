export class AdminAlreadyExistsError extends Error {
  constructor() {
    super('An admin account already exists; only one is allowed.');
    this.name = AdminAlreadyExistsError.name;
  }
}
