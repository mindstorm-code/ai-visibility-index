// Organic-result control set: for each query, the top organic web results (Firecrawl search).
// A site is a control candidate if it is in the organic results but NOT cited by the engine for that query.
// Usage: node scripts/controls.mjs   -> data/raw/organic.jsonl (resumable)
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

function loadKey() {
  if (process.env.FIRECRAWL_API_KEY) return process.env.FIRECRAWL_API_KEY;
  const f = path.join(os.homedir(), '.claude', 'skills', 'deep-research', '.env');
  const m = fs.readFileSync(f, 'utf8').match(/^FIRECRAWL_API_KEY=(.+)$/m);
  return m && m[1].trim().replace(/^["']|["']$/g, '');
}
const KEY = loadKey();
const OUT = 'data/raw/organic.jsonl';
const rows = fs.readFileSync('data/raw/gemini.jsonl', 'utf8').trim().split('\n').map(JSON.parse);
const done = new Set();
if (fs.existsSync(OUT)) for (const l of fs.readFileSync(OUT, 'utf8').split('\n')) if (l.trim()) done.add(JSON.parse(l).id);
// Random sample of queries for the control arm (rate-limit constraint; see DEVIATIONS.md).
// 20 queries per vertical, seeded shuffle, seed 20261012. Sample ids are written to data/sample-ids.json.
function mulberry32(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const rnd = mulberry32(20261012);
const sample = [];
for (const v of [...new Set(rows.map(r => r.vertical))].sort()) {
  const pool = rows.filter(r => r.vertical === v).map(r => r.id).sort((a, b) => a - b);
  for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
  sample.push(...pool.slice(0, 20));
}
fs.writeFileSync("data/sample-ids.json", JSON.stringify({ seed: 20261012, per_vertical: 20, ids: sample.sort((a, b) => a - b) }));
const inSample = new Set(sample);
const todo = rows.filter(r => inSample.has(r.id) && !done.has(r.id));
let idx = 0, ok = 0, bad = 0;
async function worker() {
  while (idx < todo.length) {
    const r = todo[idx++];
    try {
      let res;
      for (let a = 1; a <= 6; a++) {
        res = await fetch('https://api.firecrawl.dev/v2/search', {
          method: 'POST', headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: r.query, limit: 10, sources: ['web'] }),
        });
        if (res.status !== 429 && res.status < 500) break;
        await new Promise(x => setTimeout(x, a * 5000));
      }
      await new Promise(x => setTimeout(x, 1200));
      if (!res.ok) { bad++; console.error(`#${r.id} ${res.status}`); continue; }
      const j = await res.json();
      const web = (j.data?.web || j.data || []).map(x => ({ url: x.url, title: x.title })).filter(x => x.url);
      fs.appendFileSync(OUT, JSON.stringify({ id: r.id, query: r.query, collected_at: new Date().toISOString(), organic: web }) + '\n');
      ok++;
    } catch (e) { bad++; console.error(`#${r.id} ${e.message}`); }
  }
}
await worker();
console.error(`organic: ${ok} ok, ${bad} failed`);
