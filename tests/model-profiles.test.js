import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { resolveModelCatalog } from '../lib/model-profiles.js';

describe('resolveModelCatalog', () => {
  it('usa catálogo curado Polo con generaciones y versiones', async () => {
    const prev = process.env.DEV_SKIP_LLM;
    process.env.DEV_SKIP_LLM = 'true';
    try {
      const { catalog, source } = await resolveModelCatalog({ marca: 'Volkswagen', modelo: 'Polo' });
      assert.equal(source, 'curated');
      assert.ok(catalog.generaciones.length >= 1);
      const track = catalog.generaciones.find(g => /track/i.test(g.nombre));
      assert.ok(track);
      assert.ok(track.versiones.some(v => /track/i.test(v.version)));
    } finally {
      if (prev == null) delete process.env.DEV_SKIP_LLM;
      else process.env.DEV_SKIP_LLM = prev;
    }
  });

  it('Argo tiene versiones Drive y Precision', async () => {
    const prev = process.env.DEV_SKIP_LLM;
    process.env.DEV_SKIP_LLM = 'true';
    try {
      const { catalog } = await resolveModelCatalog({ marca: 'Fiat', modelo: 'Argo' });
      const vers = catalog.generaciones.flatMap(g => g.versiones.map(v => v.version));
      assert.ok(vers.some(v => /drive/i.test(v)));
      assert.ok(vers.some(v => /precision/i.test(v)));
    } finally {
      if (prev == null) delete process.env.DEV_SKIP_LLM;
      else process.env.DEV_SKIP_LLM = prev;
    }
  });
});
