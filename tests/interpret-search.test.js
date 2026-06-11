import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';

describe('interpretarBusqueda (DEV_SKIP_LLM)', () => {
  let prev;

  before(() => {
    prev = process.env.DEV_SKIP_LLM;
    process.env.DEV_SKIP_LLM = 'true';
  });

  after(() => {
    if (prev == null) delete process.env.DEV_SKIP_LLM;
    else process.env.DEV_SKIP_LLM = prev;
  });

  it('devuelve brief estructurado con filtros NL', async () => {
    const { interpretarBusqueda } = await import('../llm.js');
    const brief = await interpretarBusqueda({
      query: 'Auto de ciudad para mi esposa, menos de 20 millones',
      ciudad: 'Rosario',
      provincia: 'Santa Fe'
    });
    assert.ok(brief.explicacion);
    assert.ok(Array.isArray(brief.modelos_recomendados));
    assert.ok(brief.modelos_recomendados.length >= 2);
    assert.ok(brief.filtros.precioMax >= 19000000);
    assert.equal(brief.query_original, 'Auto de ciudad para mi esposa, menos de 20 millones');
  });
});
