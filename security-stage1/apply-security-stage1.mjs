/**
 * Katalog Darel — Security Stage 1 patch applier
 * Run from the repository root: node security-stage1/apply-security-stage1.mjs
 * The script is intentionally fail-closed: if expected source snippets differ,
 * it stops instead of silently applying a partial patch.
 */
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const write = (p, s) => fs.writeFileSync(path.join(root, p), s, 'utf8');
const replaceOnce = (source, before, after, label) => {
  const count = source.split(before).length - 1;
  if (count !== 1) throw new Error(`${label}: expected one exact match, found ${count}. No files after this step should be considered patched.`);
  return source.replace(before, after);
};

let db = read('server/db.ts');
db = replaceOnce(db,
`export function hashPassword(password: string, salt?: string): { hash: string; salt: string } {
  const generatedSalt = salt || crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, generatedSalt, 10000, 64, 'sha512').toString('hex');
  return { hash, salt: generatedSalt };
}

export function verifyPassword(password: string, hash: string, salt: string): boolean {
  const calculatedHash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
  return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(calculatedHash));
}`,
`const PASSWORD_ITERATIONS = 310000;
const LEGACY_PASSWORD_ITERATIONS = 10000;

export function hashPassword(password: string, salt?: string): { hash: string; salt: string } {
  const generatedSalt = salt || crypto.randomBytes(16).toString('hex');
  const hash = 'v2$' + crypto.pbkdf2Sync(password, generatedSalt, PASSWORD_ITERATIONS, 64, 'sha512').toString('hex');
  return { hash, salt: generatedSalt };
}

export function verifyPassword(password: string, hash: string, salt: string): boolean {
  // New hashes use 310k rounds; existing installations remain able to verify
  // legacy 10k hashes. Successful login upgrades the hash in server.ts.
  const isCurrent = hash.startsWith('v2$');
  const encoded = isCurrent ? hash.slice(3) : hash;
  const expected = Buffer.from(encoded, 'hex');
  if (expected.length !== 64) return false;
  const iterations = isCurrent ? PASSWORD_ITERATIONS : LEGACY_PASSWORD_ITERATIONS;
  const calculated = crypto.pbkdf2Sync(password, salt, iterations, 64, 'sha512');
  return calculated.length === expected.length && crypto.timingSafeEqual(expected, calculated);
}`,
'password hashing');
db = replaceOnce(db,
`  // Seed default admin if none exists
  const adminCount = (db.prepare('SELECT count(*) as count FROM users WHERE username = ?').get('admin') as { count: number }).count;
  if (adminCount === 0) {
    const { hash, salt } = hashPassword('adminpondok123');
    db.prepare(\`
      INSERT INTO users (username, password_hash, salt, name, role, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    \`).run('admin', hash, salt, 'Pengurus Koperasi Pondok', 'admin', new Date().toISOString());

    db.prepare(\`
      INSERT INTO activity_logs (action, detail, actor, timestamp)
      VALUES (?, ?, ?, ?)
    \`).run('INIT_SYSTEM', 'Inisialisasi sistem database Katalog Pondok dan pembuatan akun admin awal', 'Sistem', new Date().toISOString());
  }`,
`  // Secure first-run admin provisioning: never ship a known default password.
  const adminCount = (db.prepare('SELECT count(*) as count FROM users WHERE username = ?').get('admin') as { count: number }).count;
  if (adminCount === 0) {
    const initialPassword = process.env.ADMIN_INITIAL_PASSWORD;
    const initialUsername = (process.env.ADMIN_INITIAL_USERNAME || 'admin').trim();
    if (initialPassword) {
      if (initialPassword.length < 12) {
        throw new Error('ADMIN_INITIAL_PASSWORD must be at least 12 characters.');
      }
      if (!/^[a-zA-Z0-9_.-]{3,40}$/.test(initialUsername)) {
        throw new Error('ADMIN_INITIAL_USERNAME must be 3-40 safe characters.');
      }
      const { hash, salt } = hashPassword(initialPassword);
      db.prepare(\`
        INSERT INTO users (username, password_hash, salt, name, role, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
      \`).run(initialUsername, hash, salt, process.env.ADMIN_INITIAL_NAME || 'Administrator', 'admin', new Date().toISOString());

      db.prepare(\`
        INSERT INTO activity_logs (action, detail, actor, timestamp)
        VALUES (?, ?, ?, ?)
      \`).run('INIT_SYSTEM', 'Inisialisasi database dan pembuatan akun admin melalui environment yang aman', 'Sistem', new Date().toISOString());
    } else {
      console.warn('[SECURITY] No admin account created. Set ADMIN_INITIAL_PASSWORD (min 12 chars) and restart for first-run provisioning.');
    }
  }`,
'default admin provisioning');
let server = read('server.ts');
server = replaceOnce(server,
`// Increase JSON payload limit to handle base64 image uploads smoothly
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));`,
`// Security headers + conservative request body limits.
app.disable('x-powered-by');
app.use((_req: Request, res: Response, next: NextFunction) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
  if (isProduction) res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  next();
});
app.use(express.json({ limit: '6mb' }));
app.use(express.urlencoded({ extended: true, limit: '6mb', parameterLimit: 100 }));`,
'security headers and body limits');

server = replaceOnce(server,
`    const rawSettings = db.prepare('SELECT key, value FROM settings').all() as { key: string; value: string }[];
    const settings: Record<string, string> = {};
    for (const s of rawSettings) {
      settings[s.key] = s.value;
    }`,
`    // Explicit public allowlist: newly-added private settings stay private by default.
    const PUBLIC_SETTING_KEYS = new Set([
      'app_name', 'tagline', 'description', 'whatsapp_number', 'email',
      'address', 'open_hours', 'bank_info', 'logo_url', 'announcement', 'pondok_name'
    ]);
    const rawSettings = db.prepare('SELECT key, value FROM settings').all() as { key: string; value: string }[];
    const settings: Record<string, string> = {};
    for (const s of rawSettings) {
      if (PUBLIC_SETTING_KEYS.has(s.key)) settings[s.key] = s.value;
    }`,
'public settings allowlist');

server = replaceOnce(server,
`app.post('/api/auth/login', (req: Request, res: Response) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {`,
`// Per-process login throttling: 5 failures per IP in a rolling 15-minute window.
const loginAttempts = new Map<string, { count: number; resetAt: number; blockedUntil: number }>();
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_MAX_ATTEMPTS = 5;
const LOGIN_BLOCK_MS = 15 * 60 * 1000;
function loginThrottle(req: Request, res: Response, next: NextFunction): void {
  const key = req.ip || req.socket.remoteAddress || 'unknown';
  const now = Date.now();
  const state = loginAttempts.get(key);
  if (!state || now > state.resetAt) {
    loginAttempts.set(key, { count: 0, resetAt: now + LOGIN_WINDOW_MS, blockedUntil: 0 });
    next();
    return;
  }
  if (state.blockedUntil > now) {
    res.setHeader('Retry-After', String(Math.ceil((state.blockedUntil - now) / 1000)));
    res.status(429).json({ error: 'Terlalu banyak percobaan login. Coba lagi beberapa saat.' });
    return;
  }
  next();
}
function recordLoginFailure(req: Request): void {
  const key = req.ip || req.socket.remoteAddress || 'unknown';
  const now = Date.now();
  const state = loginAttempts.get(key) || { count: 0, resetAt: now + LOGIN_WINDOW_MS, blockedUntil: 0 };
  if (now > state.resetAt) { state.count = 0; state.resetAt = now + LOGIN_WINDOW_MS; }
  state.count += 1;
  if (state.count >= LOGIN_MAX_ATTEMPTS) state.blockedUntil = now + LOGIN_BLOCK_MS;
  loginAttempts.set(key, state);
}
function clearLoginFailures(req: Request): void {
  loginAttempts.delete(req.ip || req.socket.remoteAddress || 'unknown');
}

app.post('/api/auth/login', loginThrottle, (req: Request, res: Response) => {
  try {
    const { username, password } = req.body || {};
    if (typeof username !== 'string' || typeof password !== 'string' || !username.trim() || !password || username.length > 80 || password.length > 256) {`,
'login throttle and input validation');

server = replaceOnce(server,
`    const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username.trim()) as any;
    if (!user) {
      res.status(401).json({ error: 'Username atau password tidak cocok' });
      return;
    }

    const isValid = verifyPassword(password, user.password_hash, user.salt);
    if (!isValid) {
      res.status(401).json({ error: 'Username atau password tidak cocok' });
      return;
    }`,
`    const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username.trim()) as any;
    if (!user || !verifyPassword(password, user.password_hash, user.salt)) {
      recordLoginFailure(req);
      res.status(401).json({ error: 'Username atau password tidak cocok' });
      return;
    }
    clearLoginFailures(req);
    // Opportunistically upgrade legacy password hashes after successful login.
    const { hash: upgradedHash, salt: upgradedSalt } = hashPassword(password);
    if (!String(user.password_hash).startsWith('v2$')) {
      db.prepare('UPDATE users SET password_hash = ?, salt = ? WHERE id = ?').run(upgradedHash, upgradedSalt, user.id);
    }`,
'login failure tracking and hash upgrade');

server = replaceOnce(server,
`    const { current_password, new_password } = req.body;
    if (!current_password || !new_password) {`,
`    const { current_password, new_password } = req.body || {};
    if (typeof current_password !== 'string' || typeof new_password !== 'string' || !current_password || !new_password || new_password.length > 256) {`,
'change password validation');

server = replaceOnce(server,
`    if (new_password.length < 6) {
      res.status(400).json({ error: 'Password baru minimal 6 karakter' });`,
`    if (new_password.length < 12) {
      res.status(400).json({ error: 'Password baru minimal 12 karakter' });`,
'change password minimum');

server = replaceOnce(server,
`    db.prepare('UPDATE users SET password_hash = ?, salt = ? WHERE id = ?').run(hash, salt, userId);

    logActivity('GANTI_PASSWORD'`,
`    const revokeOtherSessions = db.transaction(() => {
      db.prepare('UPDATE users SET password_hash = ?, salt = ? WHERE id = ?').run(hash, salt, userId);
      // Revoke every session for this administrator, including the current one.
      db.prepare('DELETE FROM sessions WHERE user_id = ?').run(userId);
    });
    revokeOtherSessions();

    logActivity('GANTI_PASSWORD'`,
'password change session revocation');

server = replaceOnce(server,
`    // Match data URI pattern
    const matches = base64Data.match(/^data:([A-Za-z-+\\/]+);base64,(.+)$/);`,
`    if (typeof base64Data !== 'string' || base64Data.length > 5_600_000) {
      res.status(413).json({ error: 'Ukuran gambar maksimal 4 MB' });
      return;
    }
    if (typeof filename !== 'string' && filename !== undefined) {
      res.status(400).json({ error: 'Nama file tidak valid' });
      return;
    }
    // Match only raster formats. SVG is intentionally rejected to avoid active content.
    const matches = base64Data.match(/^data:(image\\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/]+={0,2})$/);`,
'upload format and size validation');

server = replaceOnce(server,
`    const mimeType = matches[1];
    const buffer = Buffer.from(matches[2], 'base64');

    // Determine extension
    let ext = 'jpg';
    if (mimeType === 'image/png') ext = 'png';
    else if (mimeType === 'image/webp') ext = 'webp';
    else if (mimeType === 'image/jpeg') ext = 'jpg';`,
`    const mimeType = matches[1];
    const buffer = Buffer.from(matches[2], 'base64');
    if (!buffer.length || buffer.length > 4 * 1024 * 1024) {
      res.status(413).json({ error: 'Ukuran gambar maksimal 4 MB' });
      return;
    }
    // Verify the actual file signature; do not trust the declared MIME type.
    const isJpeg = buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
    const isPng = buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
    const isWebp = buffer.length >= 12 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP';
    if ((mimeType === 'image/jpeg' && !isJpeg) || (mimeType === 'image/png' && !isPng) || (mimeType === 'image/webp' && !isWebp)) {
      res.status(400).json({ error: 'Isi file tidak sesuai dengan format gambar yang dikirim' });
      return;
    }
    const ext = mimeType === 'image/png' ? 'png' : mimeType === 'image/webp' ? 'webp' : 'jpg';`,
'upload signature validation');

server = replaceOnce(server,
`      if (base64Data.startsWith('http://') || base64Data.startsWith('https://')) {
        res.json({ url: base64Data });
        return;
      }`,
`      if (/^https:\\/\\//i.test(base64Data) && base64Data.length <= 2048) {
        res.json({ url: base64Data });
        return;
      }`,
'upload external URL policy');

write('server/db.ts', db);
write('server.ts', server);
console.log('Security Stage 1 source changes applied.');
