import { describe, it, expect } from 'vitest';
import { fmt, deriveType } from '../utils/format';

// ── fmt ───────────────────────────────────────────────────────────────────────

describe('fmt', () => {
  it('returns em dash for null', () => {
    expect(fmt(null)).toBe('—');
  });

  it('returns em dash for undefined', () => {
    expect(fmt(undefined)).toBe('—');
  });

  it('returns em dash for empty string', () => {
    expect(fmt('')).toBe('—');
  });

  it('formats a valid ISO date string', () => {
    const result = fmt('2026-07-01T12:31:00.000Z');
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(5);
    // Should include year
    expect(result).toMatch(/2026/);
  });

  it('formats a date with time component', () => {
    const result = fmt('2026-01-15T09:00:00.000Z');
    expect(result).toMatch(/Jan/);
    expect(result).toMatch(/2026/);
  });
});

// ── deriveType ────────────────────────────────────────────────────────────────

describe('deriveType', () => {
  it('returns REST API for generic input', () => {
    expect(deriveType('a product catalog service')).toBe('REST API');
  });

  it('returns REST API for empty string', () => {
    expect(deriveType('')).toBe('REST API');
  });

  it('detects Event Driven from "event" keyword', () => {
    expect(deriveType('an event processing service')).toBe('Event Driven');
  });

  it('detects Event Driven from "queue" keyword', () => {
    expect(deriveType('a queue consumer with retry logic')).toBe('Event Driven');
  });

  it('detects Event Driven from "message" keyword', () => {
    expect(deriveType('a messaging notification system')).toBe('Event Driven');
  });

  it('detects Event Driven from "notification" keyword', () => {
    expect(deriveType('push notification service')).toBe('Event Driven');
  });

  it('detects Batch from "batch" keyword', () => {
    expect(deriveType('a batch data processor')).toBe('Batch');
  });

  it('detects Batch from "job" keyword', () => {
    expect(deriveType('a nightly job runner')).toBe('Batch');
  });

  it('detects Batch from "cron" keyword', () => {
    expect(deriveType('cron task scheduler')).toBe('Batch');
  });

  it('detects CRUD from "crud" keyword', () => {
    expect(deriveType('a crud service for user management')).toBe('CRUD');
  });

  it('detects CRUD from "database" keyword', () => {
    expect(deriveType('a database management service')).toBe('CRUD');
  });

  it('detects CRUD from "storage" keyword', () => {
    expect(deriveType('a file storage api')).toBe('CRUD');
  });

  it('is case-insensitive', () => {
    expect(deriveType('EVENT DRIVEN PIPELINE')).toBe('Event Driven');
    expect(deriveType('BATCH PROCESSOR')).toBe('Batch');
  });

  it('prioritises Event Driven over Batch when both present', () => {
    expect(deriveType('a batch event queue processor')).toBe('Event Driven');
  });
});
