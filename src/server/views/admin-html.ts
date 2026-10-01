import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const adminHtmlTemplate = readFileSync(join(__dirname, 'admin.html'), 'utf-8');

export function getAdminHtml(adminPath: string): string {
  return adminHtmlTemplate.replace(
    /window\.ADMIN_PATH\s*\|\|\s*location\.pathname[^;]*/,
    `'${adminPath}'`
  );
}
