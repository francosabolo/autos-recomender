import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  listingMatchesRecommended,
  dedupeListings,
  tagRecommendedListings,
  sortListingsForBoard
} from '../lib/recommend.js';

describe('listingMatchesRecommended', () => {
  it('matchea por marca y modelo en el título', () => {
    const ok = listingMatchesRecommended(
      { titulo: 'Volkswagen Polo Trendline 2020', marca: 'Volkswagen', modelo: 'Polo' },
      [{ marca: 'Volkswagen', modelo: 'Polo' }]
    );
    assert.equal(ok, true);
  });

  it('no matchea modelo distinto', () => {
    const ok = listingMatchesRecommended(
      { titulo: 'Ford Ka 2018 SE' },
      [{ marca: 'Volkswagen', modelo: 'Polo' }]
    );
    assert.equal(ok, false);
  });
});

describe('dedupeListings', () => {
  it('elimina duplicados por huella', () => {
    const list = [
      { titulo: 'Ford Ka 2018', año: 2018, kilometros: 50000, link: 'a' },
      { titulo: 'Ford Ka 2018', año: 2018, kilometros: 50100, link: 'b' }
    ];
    assert.equal(dedupeListings(list).length, 1);
  });
});

describe('tagRecommendedListings', () => {
  it('marca recomendado según modelos', () => {
    const tagged = tagRecommendedListings(
      [{ titulo: 'Renault Sandero 2020', link: 'x' }],
      [{ marca: 'Renault', modelo: 'Sandero' }]
    );
    assert.equal(tagged[0].recomendado, true);
  });
});

describe('sortListingsForBoard', () => {
  it('prioriza recomendados', () => {
    const sorted = sortListingsForBoard([
      { titulo: 'Otro', precio: 1, recomendado: false },
      { titulo: 'Polo', precio: 2, recomendado: true }
    ]);
    assert.equal(sorted[0].titulo, 'Polo');
  });
});
