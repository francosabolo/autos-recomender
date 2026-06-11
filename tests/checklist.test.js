import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mergeChecklist, checklistProgress, emptyChecklist, CHECKLIST_KEYS } from '../lib/checklist.js';

describe('mergeChecklist', () => {
  it('parte de vacío y aplica patch parcial', () => {
    const merged = mergeChecklist({}, { vtv_ok: true, service_al_dia: false });
    assert.equal(merged.vtv_ok, true);
    assert.equal(merged.service_al_dia, false);
    assert.equal(merged.dueno_unico, null);
  });

  it('preserva valores existentes al parchear otra clave', () => {
    const merged = mergeChecklist({ vtv_ok: true }, { dueno_unico: true });
    assert.equal(merged.vtv_ok, true);
    assert.equal(merged.dueno_unico, true);
  });

  it('null en patch resetea la clave', () => {
    const merged = mergeChecklist({ vtv_ok: true }, { vtv_ok: null });
    assert.equal(merged.vtv_ok, null);
  });

  it('ignora claves desconocidas', () => {
    const merged = mergeChecklist({}, { foo: true, vtv_ok: true });
    assert.equal(merged.vtv_ok, true);
    assert.equal(merged.foo, undefined);
  });
});

describe('checklistProgress', () => {
  it('cuenta ítems revisados (true o false)', () => {
    const cl = emptyChecklist();
    cl.vtv_ok = true;
    cl.service_al_dia = false;
    assert.deepEqual(checklistProgress(cl), { done: 2, total: CHECKLIST_KEYS.length });
  });
});
