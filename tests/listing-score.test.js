import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { getCuratedCatalog } from '../lib/knowledge.js';
import { flattenCatalog } from '../lib/vehicle-catalog.js';
import {
  buildListingAnalysis,
  buildCatalogRowScore,
  scoreSeguridad
} from '../lib/listing-score.js';

describe('listing-score', () => {
  it('Ka 2021 puntúa menos seguridad que 2022', () => {
    const ka = getCuratedCatalog('Ford', 'Ka');
    const rows = flattenCatalog(ka);
    const r21 = rows.find(r => r.anio_desde <= 2021 && r.anio_hasta >= 2021);
    const r22 = rows.find(r => r.anio_desde <= 2022 && r.anio_hasta >= 2022);
    assert.ok(scoreSeguridad(r21).score < scoreSeguridad(r22).score);
  });

  it('buildListingAnalysis devuelve ficha y dimensiones', () => {
    const ka = getCuratedCatalog('Ford', 'Ka');
    const a = buildListingAnalysis(
      { titulo: 'Ford Ka SE 2022', año: 2022, precio: 14_000_000 },
      { catalogs: [ka], brief: { criterios: ['con esp'], evitar: [] }, mercado: 'normal' }
    );
    assert.ok(a.score >= 40 && a.score <= 100);
    assert.equal(a.ficha.esp, true);
    assert.ok(a.dimensiones.seguridad.score);
    assert.ok(a.dimensiones.confiabilidad.label);
  });

  it('buildCatalogRowScore para recomendación de modelo', () => {
    const ka = getCuratedCatalog('Ford', 'Ka');
    const row = flattenCatalog(ka).find(r => r.anio_desde === 2022);
    const { score, dimensiones } = buildCatalogRowScore(row, { criterios: ['cadena'], evitar: [] });
    assert.ok(score);
    assert.ok(dimensiones.seguridad);
  });
});
