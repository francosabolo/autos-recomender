import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mergeCatalog } from '../lib/catalog-merge.js';
import { normalizeCatalog } from '../lib/vehicle-catalog.js';

describe('mergeCatalog', () => {
  it('no pisa slice curated con ai', () => {
    const curated = normalizeCatalog({
      marca: 'Volkswagen',
      modelo: 'Polo',
      generaciones: [{
        id: 'polo-vi-track',
        nombre: 'Polo VI · Track',
        versiones: [{
          version: 'Track MSI',
          por_anio: [{
            anio_desde: 2018,
            anio_hasta: 2022,
            esp: false,
            meta: { source: 'curated', confidence: 0.95 }
          }]
        }]
      }]
    }, { defaultSource: 'curated' });

    const ai = normalizeCatalog({
      marca: 'Volkswagen',
      modelo: 'Polo',
      generaciones: [{
        id: 'polo-vi-track',
        nombre: 'Polo VI · Track',
        versiones: [{
          version: 'Track MSI',
          por_anio: [{
            anio_desde: 2018,
            anio_hasta: 2022,
            esp: true,
            meta: { source: 'ai', confidence: 0.6 }
          }]
        }]
      }]
    }, { defaultSource: 'ai' });

    const merged = mergeCatalog(curated, ai, 'ai');
    const slice = merged.generaciones[0].versiones[0].por_anio[0];
    assert.equal(slice.esp, false);
    assert.equal(slice.meta.source, 'curated');
  });

  it('agrega slices nuevos del incoming', () => {
    const base = normalizeCatalog({
      marca: 'VW',
      modelo: 'Polo',
      generaciones: [{
        id: 'polo-vi-track',
        nombre: 'Track',
        versiones: [{
          version: 'Track MSI',
          por_anio: [{ anio_desde: 2018, anio_hasta: 2022, esp: false }]
        }]
      }]
    });

    const patch = normalizeCatalog({
      marca: 'VW',
      modelo: 'Polo',
      generaciones: [{
        id: 'polo-vi-track',
        nombre: 'Track',
        versiones: [{
          version: 'Track MSI',
          por_anio: [{ anio_desde: 2023, anio_hasta: 2024, esp: true }]
        }]
      }]
    }, { defaultSource: 'ai' });

    const merged = mergeCatalog(base, patch, 'ai');
    const slices = merged.generaciones[0].versiones[0].por_anio;
    assert.equal(slices.length, 2);
    assert.ok(slices.some(s => s.anio_desde === 2023 && s.esp === true));
  });
});
