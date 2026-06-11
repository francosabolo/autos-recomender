import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSearchPhrase, mergeSearchFilters, parseNaturalLanguageFilters, matchesFilters } from '../lib/search-filters.js';

test('parseNaturalLanguageFilters entiende 4x4 diesel con precio máximo en millones', () => {
  const filters = parseNaturalLanguageFilters('quiero buscar 4x4 diesel de menos de 20 millones de pesos');
  assert.equal(filters.traccion, '4x4');
  assert.equal(filters.combustible, 'diesel');
  assert.equal(filters.precioMax, 20000000);
});

test('parseNaturalLanguageFilters detecta marca, modelo y año modelo', () => {
  const filters = parseNaturalLanguageFilters('Toyota Hilux modelo 2020');
  assert.equal(filters.marca, 'Toyota');
  assert.equal(filters.modelo, 'Hilux');
  assert.equal(filters.anioMin, 2020);
  assert.equal(filters.anioMax, 2020);
});

test('mergeSearchFilters permite que el formulario pise la consulta libre', () => {
  const filters = mergeSearchFilters('Toyota Hilux menos de 20 millones', {
    marca: 'Ford',
    precioMax: 18000000
  });
  assert.equal(filters.marca, 'Ford');
  assert.equal(filters.precioMax, 18000000);
});

test('matchesFilters filtra precio, año y texto técnico', () => {
  const listing = {
    titulo: 'Toyota Hilux SRV 4x4 Diesel',
    precio: 19500000,
    año: 2020
  };
  assert.equal(matchesFilters(listing, { precioMax: 20000000, anioMin: 2020, anioMax: 2020, combustible: 'diesel', traccion: '4x4' }), true);
  assert.equal(matchesFilters(listing, { precioMax: 18000000 }), false);
});

test('buildSearchPhrase prioriza filtros estructurados sobre texto libre duplicado', () => {
  const filters = mergeSearchFilters('4x4 diesel de menos de 20 millones modelo 2020', {});
  assert.equal(buildSearchPhrase(filters), '4x4 diesel 2020');
});

test('parseNaturalLanguageFilters detecta búsquedas de Ford Ka', () => {
  const filters = mergeSearchFilters('Ford Ka de menos de 20 millones de pesos', {});
  assert.equal(filters.marca, 'Ford');
  assert.equal(filters.modelo, 'KA');
  assert.equal(filters.precioMax, 20000000);
  assert.equal(buildSearchPhrase(filters), 'Ford KA');
});
