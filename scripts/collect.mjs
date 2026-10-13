// Collects AI-engine answers + citations per the pre-registration in README.md.
// Usage: node scripts/collect.mjs [--limit N] [--out data/raw/gemini.jsonl]
// Engine: Gemini with Google Search grounding. Resumable: skips queries already in the output file.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const LIMIT = Number(opt('--limit', 0));
const OUT = opt('--out', 'data/raw/gemini.jsonl');
const CONC = Number(opt('--conc', 3));
const MODEL = process.env.GEMINI_MODEL || 'gemini-3.8-flash';

// Key loading: env first, then the local deep-research .env (never committed).
function loadKey() {
  if (process.env.GEMINI_API_KEY) return process.env.GEMINI_API_KEY;
  const f = path.join(os.homedir(), '.claude', 'skills', 'deep-research', '.env');
  const m = fs.readFileSync(f, 'utf8').match(/^GEMINI_API_KEY=(.+)$/m);
  return m && m[1].trim().replace(/^["']|["']$/g, '');
}
const KEY = loadKey();
if (!KEY) { console.error('No GEMINI_API_KEY'); process.exit(1); }

const verticals = ['plumber', 'dentist', 'HVAC company', 'personal injury lawyer', 'landscaper'];
const metros = ['Phoenix, AZ', 'Dallas, TX', 'Atlanta, GA', 'Denver, CO', 'Salt Lake City, UT', 'Charlotte, NC', 'Nashville, TN', 'Tampa, FL', 'Columbus, OH', 'Sacramento, CA'];
const templates = fs.readFileSync('query-templates.txt', 'utf8').split('\n').filter(l => l.trim() && !l.startsWith('#'));
const queries = [];
for (const v of verticals) for (const m of metros) for (const t of templates) {
  queries.push({ id: queries.length + 1, vertical: v, metro: m, query: t.replace('{service}', v).replace('{metro}', m) });
}

const done = new Set();
if (fs.existsSync(OUT)) for (const l of fs.readFileSync(OUT, 'utf8').split('\n')) { if (l.trim()) done.add(JSON.parse(l).id); }
let todo = queries.filter(q => !done.has(q.id));
if (LIMIT) todo = todo.filter((_, i) => i % Math.ceil(queries.length / LIMIT) === 0).slice(0, LIMIT);

async function ask(q) {
  for (let attempt = 1; attempt <= 5; attempt++) {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
      method: 'POST', headers: { 'x-goog-api-key': KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: q.query }] }], tools: [{ google_search: {} }] }),
    });
    if (res.status === 429 || res.status >= 500) { await new Promise(r => setTimeout(r, attempt * 8000)); continue; }
    if (!res.ok) return { ...q, error: `${res.status} ${(await res.text()).slice(0, 200)}` };
    const data = await res.json();
    const c = data.candidates?.[0];
    const text = (c?.content?.parts || []).map(p => p.text || '').join('');
    const chunks = (c?.groundingMetadata?.groundingChunks || []).map(x => x.web).filter(Boolean).map(w => ({ title: w.title, uri: w.uri }));
    return { ...q, model: MODEL, collected_at: new Date().toISOString(), answer: text, citations: chunks, search_queries: c?.groundingMetadata?.webSearchQueries || [] };
  }
  return { ...q, error: 'retries exhausted' };
}

fs.mkdirSync(path.dirname(OUT), { recursive: true });
let n = 0, err = 0, idx = 0;
async function worker() {
  while (idx < todo.length) {
    const q = todo[idx++];
    const r = await ask(q);
    if (r.error) { err++; console.error(`#${q.id} ERROR ${r.error}`); continue; }
    fs.appendFileSync(OUT, JSON.stringify(r) + '\n');
    n++; if (n % 10 === 0) console.error(`${n}/${todo.length}`);
  }
}
await Promise.all(Array.from({ length: CONC }, worker));
console.error(`done: ${n} ok, ${err} errors, ${queries.length} total queries in plan`);
