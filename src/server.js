import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { readFile, writeFile, mkdir, copyFile, access } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = parseInt(process.env.PORT || '3000', 10);
const EDIT_PASSWORD = process.env.EDIT_PASSWORD || 'dev-password-trocar';
const DATA_FILE = process.env.DATA_FILE || join(__dirname, '..', 'data', 'state.json');
const INITIAL_FILE = join(__dirname, 'data', 'initial.json');
const PUBLIC_DIR = join(__dirname, 'public');

async function fileExists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function ensureDataFile() {
  await mkdir(dirname(DATA_FILE), { recursive: true });
  if (!(await fileExists(DATA_FILE))) {
    const initial = await readFile(INITIAL_FILE, 'utf-8');
    await writeFile(DATA_FILE, initial, 'utf-8');
    console.log(`[init] state.json criado a partir de initial.json em ${DATA_FILE}`);
  }
}

async function loadState() {
  const raw = await readFile(DATA_FILE, 'utf-8');
  return JSON.parse(raw);
}

async function saveState(newState) {
  const backupPath = DATA_FILE + '.bak';
  if (await fileExists(DATA_FILE)) {
    await copyFile(DATA_FILE, backupPath);
  }
  await writeFile(DATA_FILE, JSON.stringify(newState, null, 2), 'utf-8');
}

function checkAuth(c) {
  const auth = c.req.header('Authorization') || '';
  const token = auth.replace(/^Bearer\s+/i, '').trim();
  return token === EDIT_PASSWORD;
}

const app = new Hono();

app.get('/api/health', (c) => c.json({ ok: true, ts: Date.now() }));

app.get('/api/data', async (c) => {
  try {
    const state = await loadState();
    return c.json(state);
  } catch (err) {
    console.error('[GET /api/data]', err);
    return c.json({ error: 'Falha ao carregar estado' }, 500);
  }
});

app.post('/api/login', async (c) => {
  let body;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ ok: false, error: 'JSON inválido' }, 400);
  }
  const password = body?.password || '';
  if (password === EDIT_PASSWORD) {
    return c.json({ ok: true, token: EDIT_PASSWORD });
  }
  return c.json({ ok: false, error: 'Senha incorreta' }, 401);
});

app.post('/api/data', async (c) => {
  if (!checkAuth(c)) {
    return c.json({ error: 'Não autorizado' }, 401);
  }
  let newState;
  try {
    newState = await c.req.json();
  } catch {
    return c.json({ error: 'JSON inválido' }, 400);
  }
  if (!newState || typeof newState !== 'object') {
    return c.json({ error: 'Payload inválido' }, 400);
  }
  if (!newState.meta) newState.meta = {};
  newState.meta.lastUpdated = new Date().toISOString();
  try {
    await saveState(newState);
    return c.json({ ok: true, savedAt: newState.meta.lastUpdated });
  } catch (err) {
    console.error('[POST /api/data]', err);
    return c.json({ error: 'Falha ao salvar' }, 500);
  }
});

app.use('/*', serveStatic({ root: './src/public' }));
app.get('/', serveStatic({ path: './src/public/index.html' }));

await ensureDataFile();

serve({ fetch: app.fetch, port: PORT }, (info) => {
  console.log(`LBR Offseason Hub rodando em http://localhost:${info.port}`);
  console.log(`Data file: ${DATA_FILE}`);
});
