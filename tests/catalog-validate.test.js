import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { validateCatalog } from '../lib/catalog-validate.js';
import { normalizeCatalog } from '../lib/vehicle-catalog.js';

describe('validateCatalog', () => {
  it('acepta catálogo con por_anio válido', () => {
    const c = normalizeCatalog({
      marca: 'Ford',
      modelo: 'Ka',
      generaciones: [{
        id: 'ka-iii',
        nombre: 'Ka III',
        versiones: [{
          version: 'SE',
          por_anio: [
            { anio_desde: 2020, anio_hasta: 2021, esp: false },
            { anio_desde: 2022, anio_hasta: 2024, esp: true }
          ]
        }]
      }]
    });
    const r = validateCatalog(c);
    assert.equal(r.ok, true);
  });

  it('rechaza anio_desde > anio_hasta', () => {
    const r = validateCatalog({
      marca: 'Ford',
      modelo: 'Ka',
      generaciones: [{
        nombre: 'Ka',
        versiones: [{
          version: 'SE',
          por_anio: [{ anio_desde: 2024, anio_hasta: 2020, esp: false }]
        }]
      }]
    });
    assert.equal(r.ok, false);
    assert.ok(r.errors.some(e => /anio_desde/.test(e)));
  });

  it('rechaza esp ambiguo', () => {
    const r = validateCatalog({
      marca: 'VW',
      modelo: 'Polo',
      generaciones: [{
        nombre: 'Track',
        versiones: [{ version: 'MSI', esp: 'tal vez' }]
      }]
    });
    assert.equal(r.ok, false);
  });
});
