import test from 'node:test';
import assert from 'node:assert/strict';
import { applyRecipe, cleanHtmlForLlm } from '../lib/extract.js';

// Simula el HTML YA RENDERIZADO de una página de resultados (lo que devolvería un
// backend de render/anti-bot). La cascada no escribe selectores a mano: aplica una receta.
const HTML = `
<html><head><style>.x{color:red}</style></head><body>
<script>window.junk = 1</script>
<section class="results">
  <article class="aviso">
    <a class="link" href="/aviso/1"><img src="/img/1.jpg" alt=""></a>
    <h2 class="t">Ford Ka SE 1.5 2019</h2>
    <span class="price">$ 14.500.000</span>
    <ul class="attrs"><li class="year">2019</li><li class="km">62.000 km</li><li>Rosario</li></ul>
  </article>
  <article class="aviso">
    <a class="link" href="/aviso/2"><img data-src="/img/2.jpg" alt=""></a>
    <h2 class="t">Volkswagen Polo Comfortline 2021 automático</h2>
    <span class="price">$ 18.900.000</span>
    <ul class="attrs"><li class="year">2021</li><li class="km">40.000 km</li></ul>
  </article>
  <article class="aviso">
    <a class="link" href="/aviso/3"><img src="/img/3.jpg" alt=""></a>
    <h2 class="t">Toyota Hilux SRX 4x4 diésel 2020</h2>
    <span class="price">US$ 35.000</span>
    <ul class="attrs"><li class="year">2020</li><li class="km">90.000 km</li></ul>
  </article>
</section>
</body></html>`;

const RECIPE = {
  item: 'article.aviso',
  fields: {
    titulo: { sel: 'h2.t', attr: 'text' },
    precio: { sel: '.price', attr: 'text' },
    link: { sel: 'a.link', attr: 'href' },
    imagen: { sel: 'img', attr: 'src' },
    anio: { sel: '.year', attr: 'text' },
    km: { sel: '.km', attr: 'text' }
  }
};

test('applyRecipe extrae listings normalizados desde HTML + receta', () => {
  const out = applyRecipe(HTML, RECIPE, { source: 'demo', sourceLabel: 'Demo', baseUrl: 'https://portal.test/buscar' });
  assert.equal(out.length, 3);

  const [ka, polo, hilux] = out;
  assert.equal(ka.titulo, 'Ford Ka SE 1.5 2019');
  assert.equal(ka.precio, 14500000);
  assert.equal(ka.moneda, 'ARS');
  assert.equal(ka.año, 2019);
  assert.equal(ka.kilometros, 62000);
  assert.equal(ka.link, 'https://portal.test/aviso/1');
  assert.equal(ka.imagen, 'https://portal.test/img/1.jpg');

  // data-src se resuelve como fallback de imagen
  assert.equal(polo.imagen, 'https://portal.test/img/2.jpg');
  // atributos inferidos del título
  assert.equal(polo.transmision, 'automatico');
  assert.equal(hilux.traccion, '4x4');
  assert.equal(hilux.tipo, 'pickup');
  assert.equal(hilux.combustible, 'diesel');
  // moneda en dólares
  assert.equal(hilux.moneda, 'USD');
  assert.equal(hilux.precio, 35000);
});

test('applyRecipe devuelve [] si el item no matchea (cascada cae al siguiente paso)', () => {
  const out = applyRecipe(HTML, { item: 'div.no-existe', fields: {} }, { baseUrl: 'https://portal.test' });
  assert.equal(out.length, 0);
});

test('cleanHtmlForLlm saca scripts/estilos y recorta', () => {
  const clean = cleanHtmlForLlm(HTML, 100000);
  assert.ok(!clean.includes('<script'));
  assert.ok(!clean.includes('<style'));
  assert.ok(clean.includes('Ford Ka'));
  const short = cleanHtmlForLlm(HTML, 50);
  assert.ok(short.length <= 50);
});
