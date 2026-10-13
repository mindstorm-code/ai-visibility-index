// Analysis per README.md: citation rate by feature, odds ratios (95% CI), logistic regression (IRLS)
// with vertical fixed effects. Usage: node scripts/analyze.mjs -> data/results.json + prints a summary
import fs from 'node:fs';

const csv = f => fs.readFileSync(f, 'utf8').trim().split('\n').slice(1).map(l => { const o = []; let cur = '', q = false; for (const ch of l) { if (ch === '"') q = !q; else if (ch === ',' && !q) { o.push(cur); cur = ''; } else cur += ch; } o.push(cur); return o; });
const sites = Object.fromEntries(csv('data/sites.csv').map(r => [r[0], { status: +r[1], local: r[3], faq: r[4] }]));
const pairs = csv('data/pairs.csv').map(r => ({ id: r[0], vertical: r[1], metro: r[2], domain: r[3], cited: +r[4] }));
const rows = pairs.filter(p => { const s = sites[p.domain]; return s && s.status >= 200 && s.status < 400 && s.local !== '' && s.faq !== ''; })
  .map(p => ({ ...p, local: +sites[p.domain].local, faq: +sites[p.domain].faq }));

function or2x2(a, b, c, d) { // a=cited&feat, b=cited&!feat, c=ctrl&feat, d=ctrl&!feat; Haldane-Anscombe 0.5 correction
  const [A, B, C, D] = [a, b, c, d].map(x => x + 0.5); const lor = Math.log((A * D) / (B * C)); const se = Math.sqrt(1 / A + 1 / B + 1 / C + 1 / D);
  return { or: +Math.exp(lor).toFixed(2), lo: +Math.exp(lor - 1.96 * se).toFixed(2), hi: +Math.exp(lor + 1.96 * se).toFixed(2) };
}
function table(feat) {
  const c = rows.filter(r => r.cited), n = rows.filter(r => !r.cited);
  const a = c.filter(r => r[feat]).length, b = c.length - a, cc = n.filter(r => r[feat]).length, d = n.length - cc;
  return { feature: feat, cited_with: a, cited_without: b, control_with: cc, control_without: d, share_with_feature_among_cited: +(a / (c.length || 1)).toFixed(3), share_with_feature_among_control: +(cc / (n.length || 1)).toFixed(3), ...or2x2(a, b, cc, d) };
}
// Logistic regression, IRLS, clustered by query not modelled (stated limitation): X = [1, local, faq, vertical dummies]
function logit(X, y, iters = 30) {
  const p = X[0].length; let b = Array(p).fill(0);
  for (let it = 0; it < iters; it++) {
    const H = Array.from({ length: p }, () => Array(p).fill(0)), g = Array(p).fill(0);
    for (let i = 0; i < X.length; i++) { let z = 0; for (let j = 0; j < p; j++) z += X[i][j] * b[j]; const mu = 1 / (1 + Math.exp(-z)), w = mu * (1 - mu) + 1e-9; for (let j = 0; j < p; j++) { g[j] += X[i][j] * (y[i] - mu); for (let k = 0; k < p; k++) H[j][k] += w * X[i][j] * X[i][k]; } }
    const inv = invert(H); const step = inv.map(row => row.reduce((s, v, k) => s + v * g[k], 0)); b = b.map((v, j) => v + step[j]);
    if (Math.max(...step.map(Math.abs)) < 1e-8) break;
  }
  const H = Array.from({ length: p }, () => Array(p).fill(0));
  for (let i = 0; i < X.length; i++) { let z = 0; for (let j = 0; j < p; j++) z += X[i][j] * b[j]; const mu = 1 / (1 + Math.exp(-z)), w = mu * (1 - mu) + 1e-9; for (let j = 0; j < p; j++) for (let k = 0; k < p; k++) H[j][k] += w * X[i][j] * X[i][k]; }
  const cov = invert(H); return { b, se: b.map((_, j) => Math.sqrt(cov[j][j])) };
}
function invert(M) { const n = M.length, A = M.map((r, i) => [...r, ...Array.from({ length: n }, (_, j) => +(i === j))]); for (let i = 0; i < n; i++) { let m = i; for (let r = i + 1; r < n; r++) if (Math.abs(A[r][i]) > Math.abs(A[m][i])) m = r;[A[i], A[m]] = [A[m], A[i]]; const d = A[i][i] || 1e-12; for (let j = 0; j < 2 * n; j++) A[i][j] /= d; for (let r = 0; r < n; r++) if (r !== i) { const f = A[r][i]; for (let j = 0; j < 2 * n; j++) A[r][j] -= f * A[i][j]; } } return A.map(r => r.slice(n)); }

const verts = [...new Set(rows.map(r => r.vertical))];
const X = rows.map(r => [1, r.local, r.faq, ...verts.slice(1).map(v => +(r.vertical === v))]); const y = rows.map(r => r.cited);
const fit = logit(X, y);
const coef = (name, j) => ({ term: name, odds_ratio: +Math.exp(fit.b[j]).toFixed(2), ci95: [+Math.exp(fit.b[j] - 1.96 * fit.se[j]).toFixed(2), +Math.exp(fit.b[j] + 1.96 * fit.se[j]).toFixed(2)] });
const res = {
  n_rows: rows.length, n_cited: y.reduce((s, v) => s + v, 0), n_control: y.length - y.reduce((s, v) => s + v, 0), n_sites: new Set(rows.map(r => r.domain)).size,
  h1_schema: table('local'), h2_faq: table('faq'),
  logistic: { adjusted_for: 'vertical fixed effects', h1: coef('local_schema', 1), h2: coef('faq_block', 2) },
  not_tested: ['H3 (NAP consistency): requires per-business directory lookups; not feasible at this scale', 'domain-age bucket control: dropped, see DEVIATIONS.md'],
  caveats: ['Rows are (query x site); the same site can appear in many rows; standard errors are not clustered, so intervals are optimistic', 'Control set = organic top-10 sites not cited by the engine for that query', 'One engine (Gemini + Google Search grounding), US metros, five verticals', 'Feature detection is a homepage heuristic (JSON-LD parse; FAQ = FAQPage schema, <details>, or an FAQ heading)'],
};
fs.writeFileSync('data/results.json', JSON.stringify(res, null, 2));
console.log(JSON.stringify(res, null, 2));
