// 墨韵工坊 · 秘钥加密存储
// AES-256-GCM 加密,PBKDF2 派生密钥,存到 data/keys.enc.json
// 主密钥来自环境变量 MORUEN_MASTER_KEY,首次启动自动生成
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '..', 'data');
const KEY_FILE = path.join(DATA_DIR, 'keys.enc.json');
const ENV_FILE = path.join(__dirname, '..', '.env');

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function loadMasterKey() {
  // 优先级: 环境变量 > /app/backend/data/master.key(持久化) > backend/.env(镜像内,会丢) > 现场生成
  let k = process.env.MORUEN_MASTER_KEY;
  if (!k) {
    const persistedKeyFile = path.join(DATA_DIR, 'master.key');
    if (fs.existsSync(persistedKeyFile)) {
      k = fs.readFileSync(persistedKeyFile, 'utf-8').trim();
      process.env.MORUEN_MASTER_KEY = k;
    }
  }
  if (!k && fs.existsSync(ENV_FILE)) {
    const env = fs.readFileSync(ENV_FILE, 'utf-8');
    const m = env.match(/^MORUEN_MASTER_KEY=(.+)$/m);
    if (m) k = m[1].trim();
  }
  if (!k) {
    // 首次启动: 现场生成,既写 DATA_DIR(持久化) 也写 ENV_FILE(给人看)
    k = crypto.randomBytes(32).toString('hex');
    process.env.MORUEN_MASTER_KEY = k;
    ensureDataDir();
    fs.writeFileSync(path.join(DATA_DIR, 'master.key'), k + '\n', { mode: 0o600 });
    fs.writeFileSync(ENV_FILE, `MORUEN_MASTER_KEY=${k}\nPORT=8787\nALLOW_ORIGIN=*\n`);
    console.log('[keys] 已自动生成主密钥,持久化到 data/master.key');
  }
  return crypto.createHash('sha256').update(k).digest();
}

let masterKey = null;
function getMasterKey() {
  if (!masterKey) masterKey = loadMasterKey();
  return masterKey;
}

function encrypt(plaintext) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', getMasterKey(), iv);
  const ct = Buffer.concat([cipher.update(plaintext, 'utf-8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, ct]).toString('base64');
}

function decrypt(b64) {
  const buf = Buffer.from(b64, 'base64');
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const ct = buf.subarray(28);
  const decipher = crypto.createDecipheriv('aes-256-gcm', getMasterKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString('utf-8');
}

function readAll() {
  ensureDataDir();
  if (!fs.existsSync(KEY_FILE)) return { keys: {}, meta: {} };
  try {
    return JSON.parse(fs.readFileSync(KEY_FILE, 'utf-8'));
  } catch {
    return { keys: {}, meta: {} };
  }
}

function writeAll(data) {
  ensureDataDir();
  fs.writeFileSync(KEY_FILE, JSON.stringify(data, null, 2));
}

export function setKey(provider, plaintext) {
  const data = readAll();
  data.keys[provider] = encrypt(plaintext);
  data.meta[provider] = { updatedAt: new Date().toISOString() };
  writeAll(data);
}

export function getKey(provider) {
  const data = readAll();
  if (!data.keys[provider]) return null;
  try {
    return decrypt(data.keys[provider]);
  } catch (e) {
    console.error('[keys] 解密失败', provider, e.message);
    return null;
  }
}

export function deleteKey(provider) {
  const data = readAll();
  delete data.keys[provider];
  delete data.meta[provider];
  writeAll(data);
}

export function listKeys() {
  const data = readAll();
  // 返回掩码后的 key: sk-ant-****1234
  const out = {};
  for (const p of Object.keys(data.keys)) {
    const k = getKey(p);
    if (k) {
      const head = k.slice(0, Math.min(7, k.length));
      const tail = k.slice(-4);
      out[p] = `${head}****${tail}`;
    }
  }
  return out;
}

export function isConfigured(provider) {
  const data = readAll();
  return !!data.keys[provider];
}
