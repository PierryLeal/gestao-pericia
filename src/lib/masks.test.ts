import { describe, it, expect } from 'vitest';
import { formatPhone, formatCPF } from './masks';

describe('formatPhone', () => {
  it('formats progressively as digits are typed', () => {
    expect(formatPhone('1')).toBe('(1');
    expect(formatPhone('11')).toBe('(11');
    expect(formatPhone('119999')).toBe('(11) 9999');
    expect(formatPhone('11999998888')).toBe('(11) 99999-8888');
  });

  it('strips non-digit characters and caps at 11 digits', () => {
    expect(formatPhone('(11) 99999-8888extra')).toBe('(11) 99999-8888');
  });

  it('returns an empty string for empty input', () => {
    expect(formatPhone('')).toBe('');
  });
});

describe('formatCPF', () => {
  it('formats progressively as digits are typed', () => {
    expect(formatCPF('123')).toBe('123');
    expect(formatCPF('123456')).toBe('123.456');
    expect(formatCPF('123456789')).toBe('123.456.789');
    expect(formatCPF('12345678900')).toBe('123.456.789-00');
  });

  it('strips non-digit characters and caps at 11 digits', () => {
    expect(formatCPF('123.456.789-00extra')).toBe('123.456.789-00');
  });
});
