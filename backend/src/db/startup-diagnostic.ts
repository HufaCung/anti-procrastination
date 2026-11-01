// Only static, allow-listed diagnostics may reach startup logs. Driver messages
// can contain database URLs, SQL values or credentials and must never be printed.
const hints: Record<string, string> = {
  ENETUNREACH: 'Network unreachable. Use Supabase Session pooler (IPv4), port 5432.',
  EHOSTUNREACH: 'Database host unreachable. Check the Session pooler endpoint.',
  ENOTFOUND: 'Database hostname not found. Copy the exact host from Supabase Connect.',
  EAI_AGAIN: 'Database DNS lookup failed temporarily. Retry and check the endpoint.',
  ECONNREFUSED: 'Database connection refused. Check project availability, host and port.',
  ECONNRESET: 'Database connection was reset. Check project availability and network access.',
  ETIMEDOUT: 'Database connection timed out. Check project availability and network access.',
  '28P01': 'Database authentication failed. Check the pooler username and encoded database password.',
  '28000': 'Database authorization failed. Check the Session pooler username and project.',
  '3D000': 'Database does not exist. Use the database name from Supabase Connect.',
  '42501': 'Database permissions are insufficient. Use the database owner connection for migrations.',
  '42P07': 'Migration conflicts with an existing table. Use a fresh database or review its schema.',
  '42710': 'Migration conflicts with an existing database object. Review the target schema.',
  '42601': 'Migration SQL is not supported by this PostgreSQL server.',
  SELF_SIGNED_CERT_IN_CHAIN: 'TLS certificate chain is untrusted. Configure DATABASE_CA_CERT with the Supabase CA PEM.',
  DEPTH_ZERO_SELF_SIGNED_CERT: 'TLS certificate is self-signed. Configure the correct DATABASE_CA_CERT.',
  UNABLE_TO_VERIFY_LEAF_SIGNATURE: 'TLS certificate cannot be verified. Configure the Supabase CA in DATABASE_CA_CERT.',
  UNABLE_TO_GET_ISSUER_CERT_LOCALLY: 'TLS issuer is untrusted. Configure the Supabase CA in DATABASE_CA_CERT.',
  ERR_TLS_CERT_ALTNAME_INVALID: 'TLS certificate hostname mismatch. Check the exact Session pooler hostname.',
  CERT_HAS_EXPIRED: 'TLS certificate has expired. Check the certificate and database endpoint.',
  ERR_INVALID_URL: 'DATABASE_URL is not a valid URL. Percent-encode reserved characters in the password.',
  ENOENT: 'A database or migration file is missing. Check the build and local database directory.',
};

export function databaseStartupDiagnostic(error: unknown, depth = 0): string {
  if (depth > 4 || !error || typeof error !== 'object') return 'Unclassified database initialization failure.';
  if ('code' in error && typeof error.code === 'string' && Object.hasOwn(hints, error.code)) return hints[error.code];
  if ('message' in error && typeof error.message === 'string') {
    if (['Invalid DATABASE_URL', 'DATABASE_URL must be a PostgreSQL URL'].includes(error.message)) return 'DATABASE_URL must be a valid PostgreSQL URI.';
    if (error.message === 'Database migration checksum mismatch') return 'Migration checksum mismatch. Restore the deployed migration file; do not edit applied migrations.';
    if (error.message === 'Connection terminated due to connection timeout' || error.message === 'timeout exceeded when trying to connect') return hints.ETIMEDOUT;
    if (error.message === 'Tenant or user not found') return 'Pooler tenant or user not found. Copy the exact Session pooler username and host from Supabase Connect.';
  }
  if ('cause' in error) {
    const nested = databaseStartupDiagnostic(error.cause, depth + 1);
    if (!nested.startsWith('Unclassified')) return nested;
  }
  if ('errors' in error && Array.isArray(error.errors)) {
    for (const item of error.errors.slice(0, 5)) {
      const nested = databaseStartupDiagnostic(item, depth + 1);
      if (!nested.startsWith('Unclassified')) return nested;
    }
  }
  return 'Unclassified database initialization failure.';
}
