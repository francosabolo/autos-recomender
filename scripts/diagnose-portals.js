// scripts/diagnose-portals.js
// Diagnóstico real de portales con el fetch directo: ¿responden? ¿qué parser saca data?
// Uso: node scripts/diagnose-portals.js  (o:  npm run diagnose)
import { PORTALS, buscarEnPortales } from '../scraper.js';

const filtros = {
  marca: 'Ford',
  modelo: 'Ka',
  precioMax: 20000000,
  ciudad: 'Rosario',
  provincia: 'Santa Fe'
};

const ICON = { ok: '🟢', partial: '🟠', changed: '🟡', blocked: '🔴', empty: '⚪', link_only: '🔗' };

console.log(`\nDiagnóstico — búsqueda de prueba: ${filtros.marca} ${filtros.modelo} (<= $${filtros.precioMax.toLocaleString('es-AR')})`);
console.log(`Proveedor de fetch: ${process.env.SCRAPER_PROVIDER || 'direct'}\n`);

process.env.SCRAPER_CACHE_DISABLED = 'true'; // queremos el estado real, sin caché

const t0 = Date.now();
const { portal_results, listings } = await buscarEnPortales(filtros, {
  portalIds: PORTALS.map(p => p.id),
  limit: 60
});

for (const r of portal_results) {
  const icon = ICON[r.status] || '❓';
  console.log(`${icon} ${r.portal_label.padEnd(22)} ${String(r.status || '?').padEnd(9)} ${String(r.total ?? r.listings?.length ?? 0).padStart(3)} result.  método=${r.method || '-'}`);
  if (r.error) console.log(`     ↳ ${r.error}`);
  console.log(`     ↳ ${r.url}`);
}

console.log(`\nTotal combinado (deduplicado): ${listings.length} · ${Date.now() - t0} ms`);
const sample = listings.filter(l => l.precio).slice(0, 5);
if (sample.length) {
  console.log('\nMuestra de resultados reales:');
  for (const l of sample) console.log(`  • ${l.titulo} — $${(l.precio || 0).toLocaleString('es-AR')} — ${l.fuente} — ${l.link}`);
} else {
  console.log('\n(No se obtuvieron publicaciones reales con precio en esta corrida.)');
}
console.log('');
