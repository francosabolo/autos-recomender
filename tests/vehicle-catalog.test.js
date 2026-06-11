import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeCatalog,
  flattenCatalog,
  sliceCatalogForYears,
  catalogCoversYears,
  buildSpecKey,
  stableGenerationId
} from '../lib/vehicle-catalog.js';

describe('vehicle-catalog', () => {
  it('normaliza jerarquía marca modelo generación versión', () => {
    const c = normalizeCatalog({
      marca: 'Fiat',
      modelo: 'Argo',
      generaciones: [{
        nombre: 'Argo nacional',
        anio_desde: 2017,
        anio_hasta: 2025,
        versiones: [{ version: 'Drive', motor: '1.3', potencia_cv: 99 }]
      }]
    });
    assert.equal(c.marca, 'Fiat');
    assert.equal(c.generaciones[0].versiones[0].version, 'Drive');
  });

  it('migra formato plano antiguo', () => {
    const c = normalizeCatalog({
      generacion: 'Track',
      anio_desde: 2020,
      versiones: [{ nombre: 'Track MSI', motor: '1.6', potencia_cv: 110 }]
    }, { marca: 'VW', modelo: 'Polo' });
    assert.equal(c.generaciones.length, 1);
    assert.equal(c.generaciones[0].versiones[0].version, 'Track MSI');
  });

  it('sliceCatalogForYears filtra por rango', () => {
    const c = normalizeCatalog({
      generaciones: [
        { nombre: 'A', anio_desde: 2018, anio_hasta: 2019, versiones: [{ version: 'X', motor: '1.0', potencia_cv: 80 }] },
        { nombre: 'B', anio_desde: 2020, anio_hasta: 2024, versiones: [{ version: 'Y', motor: '1.6', potencia_cv: 110 }] }
      ]
    });
    const sliced = sliceCatalogForYears(c, 2020, 2024);
    assert.equal(sliced.generaciones.length, 1);
    assert.equal(sliced.generaciones[0].nombre, 'B');
  });

  it('flattenCatalog para insights', () => {
    const rows = flattenCatalog(normalizeCatalog({
      marca: 'VW',
      modelo: 'Polo',
      generaciones: [{ nombre: 'Track', versiones: [{ version: 'MSI', potencia_cv: 110 }] }]
    }));
    assert.equal(rows[0].version, 'MSI');
    assert.equal(rows[0].potencia_cv, 110);
  });

  it('genera id estable y spec_key', () => {
    const id = stableGenerationId('Volkswagen', 'Polo', 'Polo VI · Track');
    assert.ok(id.includes('polo'));
    const key = buildSpecKey({ generation_id: 'polo-vi-track', version: 'Track MSI', anio_desde: 2020, anio_hasta: 2022 });
    assert.match(key, /polo-vi-track\|Track MSI\|2020\|2022/);
  });

  it('catalogCoversYears valida rango', () => {
    const c = normalizeCatalog({
      marca: 'Ford',
      modelo: 'Ka',
      generaciones: [{
        nombre: 'Ka III',
        versiones: [{
          version: 'SE',
          motor: '1.5',
          por_anio: [
            { anio_desde: 2020, anio_hasta: 2021, esp: false },
            { anio_desde: 2022, anio_hasta: 2024, esp: true }
          ]
        }]
      }]
    });
    assert.equal(catalogCoversYears(c, 2020, 2021), true);
    assert.equal(catalogCoversYears(c, 2015, 2016), false);
  });

  it('por_anio expande filas con specs distintas por año', () => {
    const rows = flattenCatalog(normalizeCatalog({
      marca: 'Ford',
      modelo: 'Ka',
      generaciones: [{
        nombre: 'Ka III',
        versiones: [{
          version: 'SE',
          por_anio: [
            { anio_desde: 2020, anio_hasta: 2021, esp: false },
            { anio_desde: 2022, anio_hasta: 2024, esp: true }
          ]
        }]
      }]
    }));
    assert.equal(rows.length, 2);
    assert.equal(rows.find(r => r.anio_hasta === 2021).esp, false);
    assert.equal(rows.find(r => r.anio_desde === 2022).esp, true);
  });
});
