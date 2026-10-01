import { BANNED_WORDS, MAX_MESSAGE_LENGTH } from './config.js';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

const EMOJI_REGEX = /[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F600}-\u{1F64F}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]/gu;

export function validateVoice(text: string): ValidationResult {
  const errors: string[] = [];

  if (text.length > MAX_MESSAGE_LENGTH) {
    errors.push(`exceeds ${MAX_MESSAGE_LENGTH} characters (${text.length})`);
  }

  if (text.includes('!')) {
    errors.push('contains exclamation point');
  }

  if (EMOJI_REGEX.test(text)) {
    errors.push('contains emoji');
  }

  const lowerText = text.toLowerCase();
  for (const word of BANNED_WORDS) {
    const wordLower = word.toLowerCase();
    const regex = new RegExp(`\\b${wordLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
    if (regex.test(lowerText)) {
      errors.push(`contains banned word: "${word}"`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

export function isValidVoice(text: string): boolean {
  return validateVoice(text).valid;
}
