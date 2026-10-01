import { describe, it, expect } from 'vitest';
import { validateVoice, isValidVoice } from '../src/voice/validator.js';
import { BANNED_WORDS, MAX_MESSAGE_LENGTH } from '../src/voice/config.js';

describe('voice validator', () => {
  it('accepts valid voice text', () => {
    const valid = [
      '#14',
      'you will be contacted.',
      'this was left for you.',
      'nepantla.',
      '2026.10.01 — untitled',
      'it arrived in the second week.',
      'the tag is warm. you are holding it.',
      'nothing here today.',
      'closed.',
      'not here.',
    ];

    for (const text of valid) {
      const result = validateVoice(text);
      expect(result.valid, `"${text}" should be valid but got errors: ${result.errors.join(', ')}`).toBe(true);
    }
  });

  it('rejects text with exclamation points', () => {
    const result = validateVoice('welcome!');
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('contains exclamation point');
  });

  it('rejects text with emoji', () => {
    const result = validateVoice('thank you 🙏');
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('contains emoji');
  });

  it('rejects text exceeding max length', () => {
    const longText = 'a'.repeat(MAX_MESSAGE_LENGTH + 1);
    const result = validateVoice(longText);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('exceeds'))).toBe(true);
  });

  it('rejects text with banned words', () => {
    const bannedPhrases = [
      'Visionary artist',
      'Join me on this journey',
      'curated collection',
      "Don't miss out",
      'exclusive access',
      'inspired by ancient mysticism',
      'Follow me for more',
    ];

    for (const phrase of bannedPhrases) {
      const result = validateVoice(phrase);
      expect(result.valid, `"${phrase}" should be rejected`).toBe(false);
      expect(result.errors.some(e => e.includes('banned word'))).toBe(true);
    }
  });

  it('rejects all banned words individually', () => {
    for (const word of BANNED_WORDS) {
      const result = validateVoice(`this is ${word} here`);
      expect(result.valid, `banned word "${word}" should be rejected`).toBe(false);
    }
  });

  it('isValidVoice helper returns boolean', () => {
    expect(isValidVoice('valid text.')).toBe(true);
    expect(isValidVoice('invalid! text')).toBe(false);
  });

  it('allows text at exactly max length', () => {
    const exactText = 'a'.repeat(MAX_MESSAGE_LENGTH);
    const result = validateVoice(exactText);
    expect(result.valid).toBe(true);
  });

  it('collects multiple errors', () => {
    const badText = 'Join me on this journey! 🎨 ' + 'x'.repeat(150);
    const result = validateVoice(badText);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(1);
  });
});
