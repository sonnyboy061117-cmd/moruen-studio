// 配置加载器
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONFIG_DIR = path.join(__dirname, '..', 'config');

export function loadConfig(name) {
  const file = path.join(CONFIG_DIR, name + '.json');
  return JSON.parse(fs.readFileSync(file, 'utf-8'));
}

export const config = {
  providers: loadConfig('providers'),
  domains: loadConfig('domains'),
  strengths: loadConfig('strengths'),
  styles: loadConfig('styles'),
  scoring: loadConfig('scoring'),
  prompts: loadConfig('prompts')
};
