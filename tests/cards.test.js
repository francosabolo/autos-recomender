import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extraerCards } from '../lib/cards.js';

test('extraerCards sin bloque json devuelve texto íntegro', () => {
  const t = 'Solo texto sin cards.';
  const r = extraerCards(t);
  assert.equal(r.texto, t);
  assert.deepEqual(r.cards, []);
});

test('extraerCards parsea cards y limpia el bloque', () => {
  const t = `Acá van recomendaciones.

\`\`\`json
{ "cards": [ { "tipo": "recomendacion", "titulo": "Fiesta", "precio": 100 } ] }
\`\`\`
`;
  const r = extraerCards(t);
  assert.ok(!r.texto.includes('```'));
  assert.equal(r.cards.length, 1);
  assert.equal(r.cards[0].titulo, 'Fiesta');
});

test('extraerCards con JSON inválido deja texto original y cards vacías', () => {
  const t = 'Texto\n```json\n{ no json \n```';
  const r = extraerCards(t);
  assert.equal(r.texto, t);
  assert.deepEqual(r.cards, []);
});

test('extraerCards ignora cards que no son array', () => {
  const t = '```json\n{ "cards": "nope" }\n```';
  const r = extraerCards(t);
  assert.deepEqual(r.cards, []);
});
