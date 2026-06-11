import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildGuiaCompraPasos,
  enrichBriefWithTramite,
  getTransactionGuidePayload
} from '../lib/transaction-guide.js';

describe('transaction-guide', () => {
  it('expone secciones de documentación y dinero', () => {
    const g = getTransactionGuidePayload();
    assert.ok(g.secciones.length >= 5);
    const ids = g.secciones.map(s => s.id);
    assert.ok(ids.includes('dinero'));
    assert.ok(ids.includes('transferencia'));
    assert.match(g.secciones.find(s => s.id === 'dinero').items.join(' '), /transferencia bancaria/i);
  });

  it('guia_compra incluye boleto y transferencia', () => {
    const pasos = buildGuiaCompraPasos();
    const ids = pasos.pasos.map(p => p.id);
    assert.ok(ids.includes('boleto'));
    assert.ok(ids.includes('transferencia'));
    assert.match(pasos.pasos.find(p => p.id === 'boleto').titulo, /boleto/i);
  });

  it('enrichBriefWithTramite agrega guía al brief', () => {
    const b = enrichBriefWithTramite({ explicacion: 'test' });
    assert.ok(b.guia_compra?.pasos?.length >= 4);
  });
});
