import { describe, expect, it } from 'vitest';
import { databaseStartupDiagnostic } from './db/startup-diagnostic.js';

describe('safe database startup diagnostics', () => {
  it.each([
    ['28P01', 'authentication failed'],
    ['ENETUNREACH', 'Session pooler'],
    ['SELF_SIGNED_CERT_IN_CHAIN', 'DATABASE_CA_CERT'],
    ['42501', 'permissions'],
    ['42P07', 'existing table'],
    ['ERR_INVALID_URL', 'valid URL'],
  ])('explains %s without exposing driver details', (code, expected) => {
    const diagnostic = databaseStartupDiagnostic({ code, message: 'postgresql://private-user:private-password@secret-host/db', detail: 'secret SQL values' });
    expect(diagnostic).toContain(expected);
    expect(diagnostic).not.toMatch(/private|secret|postgresql:\/\//);
  });
  it('handles nested network errors and circular causes', () => {
    expect(databaseStartupDiagnostic(new AggregateError([{code:'ENETUNREACH'}]))).toContain('IPv4');
    const circular: {cause?: unknown} = {};
    circular.cause = circular;
    expect(databaseStartupDiagnostic(circular)).toBe('Unclassified database initialization failure.');
  });
  it('does not print arbitrary codes, messages or inherited property values', () => {
    for(const error of [{ code: 'password-secret', message: 'password-secret' },{code:'constructor'},new Error('password-secret')]) {
      expect(databaseStartupDiagnostic(error)).toBe('Unclassified database initialization failure.');
    }
  });
  it('returns unknown SQLSTATE and Node/OpenSSL identifiers without driver details', () => {
    expect(databaseStartupDiagnostic({ code: '42703', message: 'private column name' })).toBe('Database driver error code 42703.');
    expect(databaseStartupDiagnostic({ code: 'ERR_OSSL_PEM_BAD_BASE64_DECODE', message: 'private certificate contents' })).toBe('Database driver error code ERR_OSSL_PEM_BAD_BASE64_DECODE.');
  });
  it('explains a wrong pooler tenant and migration checksum without raw output', () => {
    expect(databaseStartupDiagnostic(new Error('Tenant or user not found'))).toContain('pooler username');
    expect(databaseStartupDiagnostic(new Error('Database migration checksum mismatch'))).toContain('checksum');
  });
});
