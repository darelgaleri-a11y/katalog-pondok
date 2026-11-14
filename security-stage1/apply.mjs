import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const backupDir = path.join(root, `.security-stage1-backup-${new Date().toISOString().replace(/[:.]/g, '-')}`);

function read(rel) {
  const file = path.join(root, rel);
  if (!fs.existsSync(file)) throw new Error(`File tidak ditemukan: ${rel}. Jalankan script dari root proyek Katalog.`);
  return fs.readFileSync(file, 'utf8');
}
function write(rel, content) {
  const file = path.join(root, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content, 'utf8');
}
function replaceOnce(source, before, after, label) {
  const count = source.split(before).length - 1;
  if (count !== 1) throw new Error(`Patch dihentikan: anchor "${label}" ditemukan ${count} kali (harus tepat 1). Tidak ada file yang ditulis.`);
  return source.replace(before, after);
}

let server = read('server.ts');
let db = read('server/db.ts');
let pkg = JSON.parse(read('package.json'));
let envExample = read('.env.example');
let gitignore = read('.gitignore');

// --- server.ts: hardening middleware, request limits, cache policy ---
server = replaceOnce(
  server,
  `const isProduction = process.env.NODE_ENV === 'production';\n\n// Increase JSON payload limit to handle base64 image uploads smoothly\napp.use(express.json({ limit: '20mb' }));\napp.use(express.urlencoded({ extended: true, limit: '20mb' }));`,
  `const isProduction = process.env.NODE_ENV === 'production';

// Basic security headers. CSP is intentionally not forced here because the
// existing Vite development flow and current frontend assets have not been audited for CSP compatibility.
app.disable('x-powered-by');
app.use((req: Request, res: Response, next: NextFunction) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  if (req.path.startsWith('/api/admin') || req.path.startsWith('/api/auth')) {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Pragma', 'no-cache');
  }
  if (isProduction) res.setHeader('Strict-Transport-Security', 'max-age=15552000; includeSubDomains');
  next();
});

// Images are limited to 5 MiB after decoding; this allows a little Base64 overhead.
app.use(express.json({ limit: '7mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));`,
  'middleware keamanan dan batas body'
);

// --- server.ts: session token hash + role check ---
server = replaceOnce(
  server,
  `function authMiddleware(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Sesi tidak valid atau belum login' });
    return;
  }

  const token = authHeader.substring(7);
  const now = Date.now();

  const session = db.prepare(\`
    SELECT s.token, s.expires_at, u.id, u.username, u.name, u.role
    FROM sessions s
    JOIN users u ON s.user_id = u.id
    WHERE s.token = ? AND s.expires_at > ?
  \`).get(token, now) as { id: number; username: string; name: string; role: string } | undefined;

  if (!session) {
    res.status(401).json({ error: 'Sesi telah berakhir atau token tidak sah' });
    return;
  }

  req.user = {
    id: session.id,
    username: session.username,
    name: session.name,
    role: session.role
  };
  next();
}`,
  `function hashSessionToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function authMiddleware(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Sesi tidak valid atau belum login' });
    return;
  }

  const token = authHeader.substring(7).trim();
  if (!/^[a-f0-9]{64}$/i.test(token)) {
    res.status(401).json({ error: 'Token sesi tidak valid' });
    return;
  }

  const now = Date.now();
  const session = db.prepare(\`
    SELECT s.token, s.expires_at, u.id, u.username, u.name, u.role
    FROM sessions s
    JOIN users u ON s.user_id = u.id
    WHERE s.token = ? AND s.expires_at > ?
  \`).get(hashSessionToken(token), now) as { id: number; username: string; name: string; role: string } | undefined;

  if (!session || session.role !== 'admin') {
    res.status(401).json({ error: 'Sesi telah berakhir atau token tidak sah' });
    return;
  }

  req.user = {
    id: session.id,
    username: session.username,
    name: session.name,
    role: session.role
  };
  next();
}`,
  'middleware sesi'
);

// --- server.ts: public settings allowlist ---
server = replaceOnce(
  server,
  `    const rawSettings = db.prepare('SELECT key, value FROM settings').all() as { key: string; value: string }[];
    const settings: Record<string, string> = {};
    for (const s of rawSettings) {
      settings[s.key] = s.value;
    }`,
  `    // Only explicitly public settings may be sent to the customer browser.
    const publicSettingKeys = [
      'app_name', 'tagline', 'description', 'whatsapp_number', 'email',
      'address', 'open_hours', 'bank_info', 'logo_url', 'announcement', 'pondok_name'
    ];
    const placeholders = publicSettingKeys.map(() => '?').join(',');
    const rawSettings = db.prepare(
      \`SELECT key, value FROM settings WHERE key IN (\${placeholders})\`
    ).all(...publicSettingKeys) as { key: string; value: string }[];
    const settings: Record<string, string> = {};
    for (const s of rawSettings) settings[s.key] = s.value;`,
  'allowlist pengaturan publik'
);

// --- server.ts: login brute force controls ---
server = replaceOnce(
  server,
  `app.post('/api/auth/login', (req: Request, res: Response) => {
  try {
    const { username, password } = req.body;`,
  `const loginAttempts = new Map<string, { failures: number; windowStartedAt: number; blockedUntil: number }>();
const LOGIN_MAX_FAILURES = 5;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_BLOCK_MS = 15 * 60 * 1000;

function getLoginAttempt(ip: string) {
  const now = Date.now();
  let record = loginAttempts.get(ip);
  if (!record || now - record.windowStartedAt >= LOGIN_WINDOW_MS) {
    record = { failures: 0, windowStartedAt: now, blockedUntil: 0 };
    loginAttempts.set(ip, record);
  }
  if (loginAttempts.size > 5000) {
    for (const [key, value] of loginAttempts) {
      if (now - value.windowStartedAt >= LOGIN_WINDOW_MS && value.blockedUntil <= now) loginAttempts.delete(key);
    }
  }
  return record;
}

app.post('/api/auth/login', (req: Request, res: Response) => {
  try {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const attempt = getLoginAttempt(ip);
    if (attempt.blockedUntil > Date.now()) {
      const retryAfter = Math.max(1, Math.ceil((attempt.blockedUntil - Date.now()) / 1000));
      res.setHeader('Retry-After', String(retryAfter));
      res.status(429).json({ error: 'Terlalu banyak percobaan login. Coba lagi 15 menit.' });
      return;
    }
    const { username, password } = req.body;`,
  'rate limit login'
);

server = replaceOnce(
  server,
  `    if (!username || !password) {
      res.status(400).json({ error: 'Username dan password wajib diisi' });
      return;
    }

    const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username.trim()) as any;
    if (!user) {
      res.status(401).json({ error: 'Username atau password tidak cocok' });
      return;
    }

    const isValid = verifyPassword(password, user.password_hash, user.salt);
    if (!isValid) {
      res.status(401).json({ error: 'Username atau password tidak cocok' });
      return;
    }

    // Generate Session Token (valid for 3 days)
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = Date.now() + 3 * 24 * 60 * 60 * 1000;`,
  `    if (typeof username !== 'string' || typeof password !== 'string' ||
        !username.trim() || !password || username.length > 80 || password.length > 256) {
      res.status(400).json({ error: 'Username dan password wajib diisi dengan format valid' });
      return;
    }

    const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username.trim()) as any;
    if (!user || !verifyPassword(password, user?.password_hash || '', user?.salt || '')) {
      attempt.failures += 1;
      if (attempt.failures >= LOGIN_MAX_FAILURES) attempt.blockedUntil = Date.now() + LOGIN_BLOCK_MS;
      res.status(401).json({ error: 'Username atau password tidak cocok' });
      return;
    }

    // Upgrade legacy password hashes to the stronger current work factor after successful login.
    const upgraded = hashPassword(password);
    db.prepare('UPDATE users SET password_hash = ?, salt = ? WHERE id = ?')
      .run(upgraded.hash, upgraded.salt, user.id);

    attempt.failures = 0;
    attempt.blockedUntil = 0;
    loginAttempts.delete(ip);

    // Expire old sessions and create a 12-hour session.
    db.prepare('DELETE FROM sessions WHERE expires_at <= ?').run(Date.now());
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = Date.now() + 12 * 60 * 60 * 1000;`,
  'validasi login dan sesi'
);

server = replaceOnce(
  server,
  `    \`).run(token, user.id, expiresAt, nowIso);`,
  `    \`).run(hashSessionToken(token), user.id, expiresAt, nowIso);`,
  'penyimpanan hash token'
);

server = replaceOnce(
  server,
  `      const token = authHeader.substring(7);
      db.prepare('DELETE FROM sessions WHERE token = ?').run(token);`,
  `      const token = authHeader.substring(7).trim();
      if (/^[a-f0-9]{64}$/i.test(token)) {
        db.prepare('DELETE FROM sessions WHERE token = ?').run(hashSessionToken(token));
      }`,
  'logout token hash'
);

// --- server.ts: change password policy and revoke other sessions ---
server = replaceOnce(
  server,
  `    if (new_password.length < 6) {
      res.status(400).json({ error: 'Password baru minimal 6 karakter' });
      return;
    }`,
  `    if (typeof new_password !== 'string' || new_password.length < 12 || new_password.length > 128) {
      res.status(400).json({ error: 'Password baru harus 12–128 karakter' });
      return;
    }`,
  'kebijakan password'
);

server = replaceOnce(
  server,
  `    db.prepare('UPDATE users SET password_hash = ?, salt = ? WHERE id = ?').run(hash, salt, userId);

    logActivity('GANTI_PASSWORD', \`Administrator '\${user.username}' telah memperbarui kata sandi akun\`, user.name);`,
  `    db.prepare('UPDATE users SET password_hash = ?, salt = ? WHERE id = ?').run(hash, salt, userId);

    // Revoke every other session for this account, but keep the current browser session alive.
    const authHeader = req.headers.authorization || '';
    const currentToken = authHeader.startsWith('Bearer ') ? authHeader.substring(7).trim() : '';
    if (currentToken) {
      db.prepare('DELETE FROM sessions WHERE user_id = ? AND token != ?')
        .run(userId, hashSessionToken(currentToken));
    } else {
      db.prepare('DELETE FROM sessions WHERE user_id = ?').run(userId);
    }

    logActivity('GANTI_PASSWORD', \`Administrator '\${user.username}' telah memperbarui kata sandi akun\`, user.name);`,
  'pencabutan sesi password'
);

// --- server.ts: secure upload validation ---
server = replaceOnce(
  server,
  `    // Match data URI pattern
    const matches = base64Data.match(/^data:([A-Za-z-+\\/]+);base64,(.+)$/);
    if (!matches || matches.length !== 3) {
      // If it's already a full URL, return it
      if (base64Data.startsWith('http://') || base64Data.startsWith('https://')) {
        res.json({ url: base64Data });
        return;
      }
      res.status(400).json({ error: 'Format data gambar tidak valid (harus data URL base64)' });
      return;
    }

    const mimeType = matches[1];
    const buffer = Buffer.from(matches[2], 'base64');

    // Determine extension
    let ext = 'jpg';
    if (mimeType === 'image/png') ext = 'png';
    else if (mimeType === 'image/webp') ext = 'webp';
    else if (mimeType === 'image/jpeg') ext = 'jpg';
    else if (mimeType === 'image/svg+xml') ext = 'svg';`,
  `    if (typeof base64Data !== 'string') {
      res.status(400).json({ error: 'Data gambar tidak valid' });
      return;
    }

    // Existing remote images are accepted only over HTTPS; the server never fetches them.
    if (/^https:\\/\\//i.test(base64Data)) {
      try {
        const remoteUrl = new URL(base64Data);
        if (remoteUrl.protocol !== 'https:') throw new Error('URL tidak aman');
        res.json({ url: remoteUrl.toString() });
        return;
      } catch {
        res.status(400).json({ error: 'URL gambar harus berupa HTTPS yang valid' });
        return;
      }
    }

    const matches = base64Data.match(/^data:(image\\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/]+={0,2})$/);
    if (!matches) {
      res.status(400).json({ error: 'Format gambar harus PNG, JPEG, atau WebP' });
      return;
    }

    const mimeType = matches[1];
    const encoded = matches[2];
    if (encoded.length > 7 * 1024 * 1024 || encoded.length % 4 !== 0) {
      res.status(413).json({ error: 'Ukuran gambar terlalu besar atau Base64 tidak valid (maksimal 5 MiB)' });
      return;
    }
    const buffer = Buffer.from(encoded, 'base64');
    if (!buffer.length || buffer.length > 5 * 1024 * 1024 || buffer.toString('base64') !== encoded) {
      res.status(413).json({ error: 'Gambar kosong, terlalu besar, atau Base64 tidak valid' });
      return;
    }

    const isPng = buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    const isJpeg = buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
    const isWebp = buffer.length >= 12 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP';
    const validSignature =
      (mimeType === 'image/png' && isPng) ||
      (mimeType === 'image/jpeg' && isJpeg) ||
      (mimeType === 'image/webp' && isWebp);
    if (!validSignature) {
      res.status(400).json({ error: 'Isi file tidak cocok dengan tipe gambar yang dikirim' });
      return;
    }

    const ext = mimeType === 'image/png' ? 'png' : mimeType === 'image/webp' ? 'webp' : 'jpg';`,
  'validasi upload gambar'
);

server = replaceOnce(
  server,
  `    fs.writeFileSync(filePath, buffer);`,
  `    fs.writeFileSync(filePath, buffer, { flag: 'wx', mode: 0o644 });`,
  'penulisan file upload'
);

// --- server/db.ts: load .env before seed, stronger password hashing, no known default credential ---
db = replaceOnce(
  db,
  `import crypto from 'crypto';`,
  `import crypto from 'crypto';
import dotenv from 'dotenv';

// Load environment variables before database initialization and first-admin provisioning.
dotenv.config();`,
  'dotenv sebelum database'
);

db = replaceOnce(
  db,
  `// Helper to hash password
export function hashPassword(password: string, salt?: string): { hash: string; salt: string } {
  const generatedSalt = salt || crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, generatedSalt, 10000, 64, 'sha512').toString('hex');
  return { hash, salt: generatedSalt };
}

export function verifyPassword(password: string, hash: string, salt: string): boolean {
  const calculatedHash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
  return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(calculatedHash));
}`,
  `// PBKDF2-SHA512: new hashes use 310,000 iterations.
// Verification accepts the old 10,000-iteration hashes so existing accounts can sign in once;
// server.ts upgrades the hash after a successful login.
const CURRENT_PASSWORD_ITERATIONS = 310000;
const LEGACY_PASSWORD_ITERATIONS = 10000;

export function hashPassword(password: string, salt?: string): { hash: string; salt: string } {
  const generatedSalt = salt || crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, generatedSalt, CURRENT_PASSWORD_ITERATIONS, 64, 'sha512').toString('hex');
  return { hash, salt: generatedSalt };
}

export function verifyPassword(password: string, hash: string, salt: string): boolean {
  if (typeof password !== 'string' || typeof hash !== 'string' || typeof salt !== 'string' || !hash || !salt) return false;
  const expected = Buffer.from(hash, 'hex');
  if (expected.length !== 64) return false;

  for (const iterations of [CURRENT_PASSWORD_ITERATIONS, LEGACY_PASSWORD_ITERATIONS]) {
    const calculated = crypto.pbkdf2Sync(password, salt, iterations, 64, 'sha512');
    if (calculated.length === expected.length && crypto.timingSafeEqual(expected, calculated)) return true;
  }
  return false;
}`,
  'hash password PBKDF2'
);

db = replaceOnce(
  db,
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
  `  // Provision the first admin only from private environment variables.
  // No hard-coded default username/password is ever created.
  const adminCount = (db.prepare('SELECT count(*) as count FROM users').get() as { count: number }).count;
  if (adminCount === 0) {
    const initialUsername = process.env.ADMIN_USERNAME?.trim();
    const initialPassword = process.env.ADMIN_PASSWORD;
    const initialName = process.env.ADMIN_NAME?.trim() || 'Administrator Katalog';

    if (initialUsername && initialPassword && initialPassword.length >= 12 && initialPassword.length <= 128) {
      const { hash, salt } = hashPassword(initialPassword);
      db.prepare(\`
        INSERT INTO users (username, password_hash, salt, name, role, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
      \`).run(initialUsername, hash, salt, initialName, 'admin', new Date().toISOString());

      db.prepare(\`
        INSERT INTO activity_logs (action, detail, actor, timestamp)
        VALUES (?, ?, ?, ?)
      \`).run('INIT_SYSTEM', 'Akun administrator pertama dibuat dari konfigurasi environment', 'Sistem', new Date().toISOString());
      console.log('[SECURITY] Akun administrator pertama berhasil dibuat dari environment.');
    } else {
      console.warn('[SECURITY] Belum ada akun admin. Isi ADMIN_USERNAME dan ADMIN_PASSWORD (12–128 karakter) di environment, lalu mulai ulang aplikasi.');
    }
  }`,
  'hapus akun admin default'
);

// --- frontend: match the server's stronger password rule ---
let adminSettings = read('src/pages/admin/AdminSettingsPage.tsx');
adminSettings = replaceOnce(
  adminSettings,
  `if (newPassword.length < 6) {
      setPassError('Password baru minimal 6 karakter');`,
  `if (newPassword.length < 12) {
      setPassError('Password baru minimal 12 karakter');`,
  'validasi password pada form admin'
);
adminSettings = replaceOnce(
  adminSettings,
  `placeholder="Minimal 6 karakter"`,
  `placeholder="Minimal 12 karakter"`,
  'placeholder password admin'
);

// --- package scripts: make the existing TS server startable in production ---
pkg.scripts = pkg.scripts || {};
pkg.scripts.start = 'tsx server.ts';
pkg.dependencies = pkg.dependencies || {};
pkg.devDependencies = pkg.devDependencies || {};
if (pkg.devDependencies.tsx) {
  pkg.dependencies.tsx = pkg.devDependencies.tsx;
  delete pkg.devDependencies.tsx;
}
pkg.dependencies.tsx = pkg.dependencies.tsx || '^4.21.0';

// --- env example: explicit first admin bootstrap; placeholders only ---
if (!envExample.includes('ADMIN_USERNAME=')) {
  envExample += `

# First administrator is created only when the users table is empty.
# Use a unique username and a strong password (12-128 characters).
ADMIN_USERNAME="admin"
ADMIN_PASSWORD="REPLACE_WITH_A_UNIQUE_PASSWORD_AT_LEAST_12_CHARACTERS"
ADMIN_NAME="Administrator Katalog"
`;
}

// --- ignore local DB and uploaded customer/admin data ---
const ignoreLines = [
  '',
  '# Local database files contain application/customer data and must not be committed.',
  'data/*.db',
  'data/*.db-*',
  'data/*.sqlite',
  'data/*.sqlite-*',
  '',
  '# Uploaded files are runtime data; keep them out of source control.',
  'public/uploads/*',
  '!public/uploads/.gitkeep'
];
for (const line of ignoreLines) {
  if (line && !gitignore.split(/\r?\n/).includes(line)) gitignore += `\n${line}`;
}

const changes = [
  ['server.ts', server],
  ['server/db.ts', db],
  ['src/pages/admin/AdminSettingsPage.tsx', adminSettings],
  ['package.json', JSON.stringify(pkg, null, 2) + '\n'],
  ['.env.example', envExample],
  ['.gitignore', gitignore.replace(/\n{3,}/g, '\n\n')]
];

// All anchors have been checked before touching any file. Back up original files first.
fs.mkdirSync(backupDir, { recursive: true });
for (const [rel] of changes) {
  const source = path.join(root, rel);
  fs.copyFileSync(source, path.join(backupDir, rel.replaceAll('/', '__')));
}
for (const [rel, content] of changes) write(rel, content);

console.log('Patch keamanan Tahap 1 berhasil diterapkan.');
console.log(`Backup file asli: ${backupDir}`);
console.log('Catatan: sesi admin lama akan tidak berlaku karena token sesi sekarang disimpan sebagai hash. Silakan login kembali.');
console.log('Catatan: untuk database BARU, isi ADMIN_USERNAME dan ADMIN_PASSWORD sebelum menjalankan aplikasi pertama kali.');
