export const BANNED_WORDS = [
  'visionary',
  'journey',
  'exploring',
  'explore',
  'passion',
  'passionate',
  'curated',
  'unique',
  'iconic',
  'drop',
  'exclusive',
  'community',
  'vibe',
  'inspire',
  'inspired',
  'ancient',
  'mystical',
  'brand',
  'content',
  'creator',
  'follow',
  'subscribe',
  'link in bio',
  "don't miss",
];

export const APPROVED_NAHUATL_WORDS = [
  'ixiptla',
  'teyolia',
  'amatl',
  'nepantla',
];

export const GENERATOR_PROMPT = `Write as Ara: lowercase, one or two short declarative sentences, no exclamation points, no emoji, no calls to action, no adjectives about the work's greatness, at most one Nahuatl word from the approved list, never explained. Refer to a concrete fact about the recipient. If in doubt, output fewer words.`;

export const MAX_MESSAGE_LENGTH = 140;

export const VOICE_CONSTRAINTS = {
  maxLength: MAX_MESSAGE_LENGTH,
  bannedWords: BANNED_WORDS,
  approvedNahuatlWords: APPROVED_NAHUATL_WORDS,
  noExclamationPoints: true,
  noEmoji: true,
  noQuestionMarksToReader: true,
  lowercaseSystemText: true,
};
