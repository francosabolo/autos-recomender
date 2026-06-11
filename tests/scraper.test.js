import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { parseListings } from '../scraper.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

test('parseListings extrae título, precio, año y km del fixture', () => {
  const html = fs.readFileSync(path.join(__dirname, 'fixtures', 'ml-search-snippet.html'), 'utf8');
  const listings = parseListings(html);
  assert.equal(listings.length, 1);
  const [l] = listings;
  assert.match(l.titulo, /Corolla/);
  assert.equal(l.precio, 18500000);
  assert.equal(l.año, 2018);
  assert.equal(l.kilometros, 75000);
  assert.ok(l.link?.includes('mercadolibre'));
  assert.ok(l.imagen?.includes('mlstatic'));
});

test('parseListings con HTML vacío devuelve array vacío', () => {
  assert.deepEqual(parseListings('<html></html>'), []);
});
