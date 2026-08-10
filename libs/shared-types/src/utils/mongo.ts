/** MongoDB's "duplicate key" error code — thrown when a unique index
 * rejects a write. Every service's Mongo repositories check for this to
 * turn a race on a unique constraint into a domain-level error. */
export const MONGO_DUPLICATE_KEY_ERROR_CODE = 11000;

export function isMongoDuplicateKeyError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code: unknown }).code === MONGO_DUPLICATE_KEY_ERROR_CODE
  );
}
