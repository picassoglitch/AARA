/**
 * Resolves the database URL from various environment variable names.
 * Vercel integrations (e.g., Neon) may create vars with custom prefixes.
 * Prefers pooled URLs over unpooled for connection efficiency.
 *
 * The aara_ prefixed vars come first: a generic DATABASE_URL in the
 * environment (e.g. another project's .env) must never win over aara's own
 * database, or aara writes its tables into someone else's db.
 */

const KNOWN_ENV_NAMES = [
  'aara_DATABASE_URL',
  'aara_POSTGRES_URL',
  'DATABASE_URL',
  'POSTGRES_URL',
];

export interface ResolveResult {
  url: string | null;
  source: string | null;
  checkedNames: string[];
}

export function resolveDatabaseUrl(): ResolveResult {
  const checkedNames: string[] = [...KNOWN_ENV_NAMES];

  for (const name of KNOWN_ENV_NAMES) {
    const value = process.env[name];
    if (value) {
      return { url: value, source: name, checkedNames };
    }
  }

  const dynamicMatches: { name: string; value: string }[] = [];
  for (const [name, value] of Object.entries(process.env)) {
    if (!value) continue;
    if (name.endsWith('_DATABASE_URL') && !name.endsWith('_UNPOOLED')) {
      if (!KNOWN_ENV_NAMES.includes(name)) {
        checkedNames.push(name);
        dynamicMatches.push({ name, value });
      }
    } else if (name.endsWith('_POSTGRES_URL') && !name.endsWith('_UNPOOLED')) {
      if (!KNOWN_ENV_NAMES.includes(name)) {
        checkedNames.push(name);
        dynamicMatches.push({ name, value });
      }
    }
  }

  if (dynamicMatches.length > 0) {
    const match = dynamicMatches[0];
    return { url: match.value, source: match.name, checkedNames };
  }

  return { url: null, source: null, checkedNames };
}

/**
 * Returns the list of env var names that will be checked for database URLs.
 * Useful for error messages and documentation.
 */
export function getDatabaseEnvNames(): string[] {
  const names = [...KNOWN_ENV_NAMES];
  for (const name of Object.keys(process.env)) {
    if (name.endsWith('_DATABASE_URL') && !name.endsWith('_UNPOOLED')) {
      if (!names.includes(name)) names.push(name);
    } else if (name.endsWith('_POSTGRES_URL') && !name.endsWith('_UNPOOLED')) {
      if (!names.includes(name)) names.push(name);
    }
  }
  return names;
}
