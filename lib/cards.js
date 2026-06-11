/**
 * Busca un bloque ```json ... ``` en la respuesta y extrae las cards.
 * @param {string} texto
 * @returns {{ texto: string, cards: unknown[] }}
 */
export function extraerCards(texto) {
  const match = texto.match(/```json\s*([\s\S]*?)\s*```/);
  if (!match) return { texto, cards: [] };

  try {
    const data = JSON.parse(match[1]);
    const textoLimpio = texto.replace(match[0], '').trim();
    return { texto: textoLimpio, cards: Array.isArray(data.cards) ? data.cards : [] };
  } catch {
    return { texto, cards: [] };
  }
}
