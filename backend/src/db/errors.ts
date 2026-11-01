export class DataValidationError extends Error {}
export function isDataValidationError(error: unknown): boolean {
  if (error instanceof DataValidationError) return true;
  if (!error || typeof error !== 'object' || !('code' in error) || typeof error.code !== 'string') return false;
  return ['23503', '23505', '23514', '22P02', '22007', '22008'].includes(error.code) || error.code.startsWith('SQLITE_CONSTRAINT');
}
