import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { analyzeAdvisorQuery, parseAdvisorFilters } from '../lib/advisor-query.js';
import { getCuratedCatalog } from '../lib/knowledge.js';

const sample = [
  { id: '1', titulo: 'Ford Ka 2015', precio: 12000000, kilometros: 80000, link: 'https://a/1' },
  { id: '2', titulo: 'Ford Ka 2014', precio: 11000000, kilometros: 45000, link: 'https://a/2' },
  { id: '3', titulo: 'VW Polo 2019', precio: 18000000, kilometros: 60000, link: 'https://a/3' },
  { id: '4', titulo: 'VW Polo 2018 GTS', precio: 22000000, kilometros: 40000, link: 'https://a/4' },
  { id: '5', titulo: 'Renault Sandero 2017', precio: 9500000, kilometros: 70000, link: 'https://a/5' }
];

describe('parseAdvisorFilters', () => {
  it('entiende precio y km', () => {
    const f = parseAdvisorFilters('auto por menos de 20 millones y menos de 50 mil km');
    assert.ok(f.precioMax >= 19000000);
    assert.equal(f.kmMax, 50000);
  });

  it('detecta orden por potencia', () => {
    const f = parseAdvisorFilters('dame el auto mas potente por 15 m');
    assert.equal(f.sort, 'potencia');
    assert.ok(f.precioMax >= 14000000);
  });
});

describe('analyzeAdvisorQuery', () => {
  it('filtra por km y precio', () => {
    const r = analyzeAdvisorQuery('recomendame algo hasta 20 millones y menos de 50 mil km', sample);
    assert.ok(r.resumen.coincidenFiltros >= 1);
    assert.ok(r.destacados.every(d => (d.km == null || d.km <= 50000)));
  });

  it('ordena por potencia estimada', () => {
    const r = analyzeAdvisorQuery('el mas potente hasta 25 millones', sample);
    assert.ok(r.destacados.length >= 1);
    const top = r.destacados[0];
    assert.match(top.titulo, /GTS|Polo/i);
  });

  it('incluye insight de modelo cuando hay ficha', () => {
    const r = analyzeAdvisorQuery('que onda el ka', sample);
    const ka = r.destacados.find(d => /ka/i.test(d.titulo));
    if (ka) assert.ok(ka.insightModelo);
  });

  it('filtra por ESP usando catálogo por año', () => {
    const kaCatalog = getCuratedCatalog('Ford', 'Ka');
    const kaListings = [
      { id: 'k1', titulo: 'Ford Ka SE 2021', año: 2021, precio: 12_000_000, link: 'https://a/k1' },
      { id: 'k2', titulo: 'Ford Ka SE 2022', año: 2022, precio: 14_000_000, link: 'https://a/k2' },
      { id: 'k3', titulo: 'Ford Ka SE 2023', año: 2023, precio: 15_000_000, link: 'https://a/k3' }
    ];
    const r = analyzeAdvisorQuery('ford ka con esp', kaListings, [kaCatalog]);
    assert.equal(r.filtros.esp, true);
    assert.equal(r.resumen.coincidenFiltros, 2);
    assert.ok(r.destacados.every(d => d.año >= 2022));
  });
});
