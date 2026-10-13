// Builds the site table (cited + control) and extracts on-page features from each homepage.
// Usage: node scripts/features.mjs -> data/sites.csv (+ data/pairs.csv, one row per query x site)
import fs from 'node:fs';

const AGG = /(^|\.)(yelp|angi|angieslist|homeadvisor|thumbtack|bbb|yellowpages|mapquest|facebook|instagram|linkedin|youtube|reddit|nextdoor|forbes|consumeraffairs|trustpilot|google|healthgrades|zocdoc|avvo|justia|findlaw|superlawyers|lawyers|martindale|expertise|threebestrated|toprateddentist|homeguide|houzz|porch|networx|fixr|bark|chamberofcommerce|manta|wikipedia|nytimes|usnews|bobvila|thisoldhouse|angi|buildzoom|clutch|glassdoor|indeed|ratemds|webmd|yahoo|bing|pinterest|tiktok|x|twitter|medium|quora|apple|amazon|cbsnews|nbcnews|abcnews|usatoday|patch|ca|nerdwallet|wiki|vitals|1800dentist|dentistry\.com|lawyer\.com|nolo|legalmatch|avvo|credibledoc|tripadvisor|groupon|angi)\.com$|\.(gov|edu|org)$|\.gov\./i;
const domainOf = u => { try { return new URL(u).hostname.replace(/^www\./, '').toLowerCase(); } catch { return null; } };
const isAgg = d => !d || AGG.test(d);

const g = fs.readFileSync('data/raw/gemini.jsonl', 'utf8').trim().split('\n').map(JSON.parse);
const org = fs.existsSync('data/raw/organic.jsonl') ? Object.fromEntries(fs.readFileSync('data/raw/organic.jsonl', 'utf8').trim().split('\n').filter(Boolean).map(l => { const j = JSON.parse(l); return [j.id, j]; })) : {};

const pairs = []; const sites = new Set();
const SAMPLE = new Set(JSON.parse(fs.readFileSync('data/sample-ids.json', 'utf8')).ids);
for (const r of g.filter(r => SAMPLE.has(r.id) && org[r.id])) {
  const cited = new Set(r.citations.map(c => (c.title || '').replace(/^www\./, '').toLowerCase()).filter(d => d && !isAgg(d)));
  const ctrl = new Set(((org[r.id] || {}).organic || []).map(o => domainOf(o.url)).filter(d => d && !isAgg(d) && !cited.has(d)));
  for (const d of cited) { pairs.push({ id: r.id, vertical: r.vertical, metro: r.metro, domain: d, cited: 1 }); sites.add(d); }
  for (const d of ctrl) { pairs.push({ id: r.id, vertical: r.vertical, metro: r.metro, domain: d, cited: 0 }); sites.add(d); }
}

async function grab(domain) {
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 12000);
  try {
    const res = await fetch('https://' + domain, { signal: ctl.signal, redirect: 'follow', headers: { 'User-Agent': 'Mozilla/5.0 (compatible; AIVisibilityIndexResearch/1.0; +https://github.com/mindstorm-code/ai-visibility-index)' } });
    const html = (await res.text()).slice(0, 600000);
    const ld = [...html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)].map(m => m[1]);
    let types = new Set();
    const walk = o => { if (!o || typeof o !== 'object') return; if (Array.isArray(o)) return o.forEach(walk); const t = o['@type']; (Array.isArray(t) ? t : t ? [t] : []).forEach(x => types.add(String(x))); Object.values(o).forEach(walk); };
    for (const s of ld) { try { walk(JSON.parse(s)); } catch { /* invalid JSON-LD counts as none */ } }
    const typeStr = [...types].join('|');
    const localSchema = /(LocalBusiness|Plumber|Dentist|HVACBusiness|Attorney|LegalService|HomeAndConstructionBusiness|LandscapingBusiness|GeneralContractor|ProfessionalService|MedicalBusiness|Organization)/.test(typeStr) ? 1 : 0;
    const faq = (/FAQPage/.test(typeStr) || /<details[\s>]/i.test(html) || /frequently asked questions|>\s*FAQs?\s*</i.test(html)) ? 1 : 0;
    return { domain, status: res.status, schema_types: typeStr, local_schema: localSchema, faq };
  } catch (e) { return { domain, status: 0, schema_types: '', local_schema: '', faq: '' }; }
  finally { clearTimeout(t); }
}
const list = [...sites]; const out = []; let i = 0;
await Promise.all(Array.from({ length: 8 }, async () => { while (i < list.length) { out.push(await grab(list[i++])); } }));
const esc = v => `"${String(v).replace(/"/g, '""')}"`;
fs.writeFileSync('data/sites.csv', 'domain,status,schema_types,local_schema,faq\n' + out.map(o => [o.domain, o.status, esc(o.schema_types), o.local_schema, o.faq].join(',')).join('\n'));
fs.writeFileSync('data/pairs.csv', 'query_id,vertical,metro,domain,cited\n' + pairs.map(p => [p.id, esc(p.vertical), esc(p.metro), p.domain, p.cited].join(',')).join('\n'));
console.error(`sites ${out.length}, reachable ${out.filter(o => o.status >= 200 && o.status < 400).length}, pairs ${pairs.length} (cited ${pairs.filter(p => p.cited).length})`);
