import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { getCuratedKnowledge } from '../lib/knowledge.js';

describe('getCuratedKnowledge', () => {
  it('devuelve ficha enriquecida del Ford Ka 2013', () => {
    const k = getCuratedKnowledge('Ford', 'Ka', 2013);
    assert.ok(k);
    assert.ok(k.seguridad?.ncap_estrellas);
    assert.ok(k.equipamiento?.length);
    assert.ok(k.evitar_si?.length);
  });

  it('explica ESP en criollo', () => {
    const k = getCuratedKnowledge('Ford', 'Ka', 2013);
    const esp = k.equipamiento.find(e => e.nombre.includes('estabilidad'));
    assert.match(esp.explicacion_coloquial, /patin/i);
  });
});
