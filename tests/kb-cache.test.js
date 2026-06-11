import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { resetDbForTests } from '../lib/db.js';

describe('KB cache modelos', () => {
  let resolveModelCatalog;
  let queryVehicleYearSpecs;
  let saveKnowledge;
  let syncVehicleYearSpecs;
  let getKnowledge;
  let normalizeCatalog;

  before(async () => {
    resetDbForTests();
    process.env.SQLITE_PATH = ':memory:';
    process.env.DEV_SKIP_LLM = 'true';
    ({ resolveModelCatalog } = await import('../lib/model-profiles.js'));
    ({ queryVehicleYearSpecs, saveKnowledge, syncVehicleYearSpecs, getKnowledge } = await import('../lib/db.js'));
    ({ normalizeCatalog } = await import('../lib/vehicle-catalog.js'));
  });

  after(() => {
    resetDbForTests();
    delete process.env.SQLITE_PATH;
    delete process.env.DEV_SKIP_LLM;
  });

  it('segunda consulta Polo usa caché sin regenerar', async () => {
    const first = await resolveModelCatalog({ marca: 'Volkswagen', modelo: 'Polo' });
    assert.equal(first.cached, false);
    assert.equal(first.source, 'curated');

    const second = await resolveModelCatalog({ marca: 'Volkswagen', modelo: 'Polo' });
    assert.equal(second.cached, true);
    assert.ok(second.catalog.generaciones.length >= 1);
  });

  it('query año 2020 Track → esp false', async () => {
    await resolveModelCatalog({ marca: 'Volkswagen', modelo: 'Polo' });
    const rows = queryVehicleYearSpecs('Volkswagen', 'Polo', { year: 2020 });
    assert.ok(rows.length >= 1);
    const trackRow = rows.find(r => /track/i.test(r.version));
    assert.ok(trackRow, 'debe haber fila Track');
    const specs = JSON.parse(trackRow.specs);
    assert.equal(specs.esp, false);
  });

  it('merge al persistir no pisa curated existente', async () => {
    const curated = normalizeCatalog({
      marca: 'Test',
      modelo: 'Merge',
      generaciones: [{
        id: 'test-gen',
        nombre: 'Gen',
        versiones: [{
          version: 'Base',
          por_anio: [{
            anio_desde: 2020,
            anio_hasta: 2022,
            esp: false,
            meta: { source: 'curated', confidence: 0.99 }
          }]
        }]
      }]
    }, { defaultSource: 'curated' });
    saveKnowledge({ marca: 'Test', modelo: 'Merge', content: curated, source: 'curated' });
    syncVehicleYearSpecs(curated, 'curated');

    const aiPatch = normalizeCatalog({
      marca: 'Test',
      modelo: 'Merge',
      generaciones: [{
        id: 'test-gen',
        nombre: 'Gen',
        versiones: [{
          version: 'Base',
          por_anio: [{
            anio_desde: 2020,
            anio_hasta: 2022,
            esp: true,
            meta: { source: 'ai', confidence: 0.5 }
          }]
        }]
      }]
    }, { defaultSource: 'ai' });

    const { mergeCatalog } = await import('../lib/catalog-merge.js');
    const merged = mergeCatalog(curated, aiPatch, 'ai');
    saveKnowledge({ marca: 'Test', modelo: 'Merge', content: merged, source: 'curated' });
    syncVehicleYearSpecs(merged, 'curated');

    const stored = getKnowledge('Test', 'Merge');
    const slice = stored.content.generaciones[0].versiones[0].por_anio[0];
    assert.equal(slice.esp, false);

    const rows = queryVehicleYearSpecs('Test', 'Merge', { year: 2021 });
    assert.equal(JSON.parse(rows[0].specs).esp, false);
  });
});
