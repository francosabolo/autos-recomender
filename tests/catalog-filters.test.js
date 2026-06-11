import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { getCuratedCatalog } from '../lib/knowledge.js';
import { flattenCatalog, matchListingToCatalogRow } from '../lib/vehicle-catalog.js';
import {
  parseCatalogSpecFilters,
  filterListingsByCatalogSpecs
} from '../lib/catalog-filters.js';

const kaCatalog = getCuratedCatalog('Ford', 'Ka');

describe('catalog-filters', () => {
  it('parsea filtro con ESP', () => {
    assert.deepEqual(parseCatalogSpecFilters('mostrame ka con esp'), { esp: true });
    assert.deepEqual(parseCatalogSpecFilters('sin esp'), { esp: false });
  });

  it('Ford Ka 2021 vs 2022 — ESP en catálogo', () => {
    const rows = flattenCatalog(kaCatalog);
    const r2021 = rows.find(r => r.anio_desde <= 2021 && r.anio_hasta >= 2021);
    const r2022 = rows.find(r => r.anio_desde <= 2022 && r.anio_hasta >= 2022);
    assert.equal(r2021?.esp, false);
    assert.equal(r2022?.esp, true);
  });

  it('filtra listings por ESP usando catálogo', () => {
    const listings = [
      { titulo: 'Ford Ka SE 2021', año: 2021, precio: 12_000_000 },
      { titulo: 'Ford Ka SE 2022', año: 2022, precio: 14_000_000 }
    ];
    const filtered = filterListingsByCatalogSpecs(listings, { esp: true }, [kaCatalog]);
    assert.equal(filtered.length, 1);
    assert.equal(filtered[0].año, 2022);
    assert.equal(filtered[0].catalog_esp, true);
  });

  it('matchListingToCatalogRow asigna ESP por año', () => {
    const row = matchListingToCatalogRow({ titulo: 'Ford Ka SE', año: 2021 }, [kaCatalog]);
    assert.equal(row.esp, false);
    const row22 = matchListingToCatalogRow({ titulo: 'Ford Ka SE', año: 2022 }, [kaCatalog]);
    assert.equal(row22.esp, true);
  });
});
