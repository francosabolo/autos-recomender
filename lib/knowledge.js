// lib/knowledge.js
// Semilla curada de conocimiento por modelo (mercado argentino). Sirve como base
// del KB y como fallback cuando no hay API key para generar con Claude.

import { normalizeText } from './search-filters.js';

const CURATED = {
  'ford ka 2013': {
    resumen:
      'Ka clásico (gen 2008-2014): hatch chico urbano, mecánica simple y repuestos baratos. Buen primer auto de ciudad si está bien mantenido.',
    versiones: [
      { nombre: 'Fly Viral / Base', detalle: 'Entrada de gama, equipamiento mínimo.' },
      { nombre: 'Fly Plus', detalle: 'La más común; aire, levantavidrios delanteros.' },
      { nombre: 'Fly Viral Plus / Trend', detalle: 'Más equipamiento según año.' }
    ],
    equipamiento: [
      {
        nombre: 'Control de estabilidad (ESP)',
        valor: 'No en la mayoría de versiones',
        explicacion_coloquial: 'No te corrige si patinás en lluvia — manejá con más cuidado en mojado.'
      },
      {
        nombre: 'Airbags',
        valor: '2 frontales (según versión)',
        explicacion_coloquial: 'Solo los de adelante; no trae laterales ni de cortina en esta generación.'
      },
      {
        nombre: 'Motor',
        valor: '1.0 / 1.6 Sigma nafta',
        explicacion_coloquial: 'Mecánica conocida y barata de mantener; el 1.0 alcanza para ciudad.'
      },
      {
        nombre: 'Distribución',
        valor: 'Correa (no cadena)',
        explicacion_coloquial: 'Hay que cambiar la correa cada ~60-80 mil km; si no la cambiaron, negociá fuerte.'
      }
    ],
    seguridad: {
      airbags: '2 frontales en versiones equipadas',
      ncap_estrellas: '2 estrellas Latin NCAP (generación 2008-2014)',
      esp: false,
      explicacion_coloquial:
        'Es un auto de ciudad de otra época: pocos airbags, sin control de estabilidad y calificación baja en crash tests. No es el más seguro para ruta.'
    },
    problemas_comunes: [
      'Correa de distribución: clave cambiarla a tiempo; rotura = motor fuera de juego.',
      'Suspensión delantera con desgaste temprano en calles malas.',
      'Acabados de interior frágiles (plásticos, tapizados).'
    ],
    evitar_si: [
      'No tiene comprobante de cambio de correa de distribución',
      'Motor ruidoso o con pérdida de aceite',
      'Muchos dueños previos sin historial claro'
    ],
    que_chequear: [
      'Factura o comprobante del cambio de correa y bomba de agua.',
      'Estado del embrague y caja (ruidos al soltar).',
      'VTV al día y sin humo en escape.',
      'Funcionamiento de levantavidrios y cerraduras.'
    ],
    precio_orientativo: 'En 2026 suele rondar valores bajos por antigüedad; validá contra el feed por km y estado.'
  },
  'ford ka': {
    resumen: 'Hatch/sedán chico, urbano y económico (gen 2016-2021). Mecánica simple y repuestos accesibles.',
    versiones: [
      { nombre: 'S', detalle: 'Entrada de gama, equipamiento básico.' },
      { nombre: 'SE', detalle: 'La más común en usados; buen equilibrio precio/equipo.' },
      { nombre: 'SE Plus / SEL', detalle: 'Más equipamiento (climatizador, pantalla).' },
      { nombre: 'Freestyle', detalle: 'Versión “aventura” con kit estético y algo más de despeje.' }
    ],
    equipamiento: [
      {
        nombre: 'Control de estabilidad (ESP)',
        valor: 'Sí en versiones SE+',
        explicacion_coloquial: 'Te ayuda a no patinar si frenás fuerte en curva o lluvia.'
      },
      { nombre: 'Motor 1.5 Sigma', valor: 'Nafta, distribución a correa', explicacion_coloquial: 'Confiable para ciudad; revisá cuándo cambiaron la correa.' }
    ],
    seguridad: {
      airbags: '2 frontales (4 en versiones tope según año)',
      ncap_estrellas: '3 estrellas Latin NCAP (gen 2016+)',
      esp: true,
      explicacion_coloquial: 'Mejor que el Ka viejo, pero sigue siendo un hatch chico — no esperes seguridad de SUV.'
    },
    problemas_comunes: [
      'Electrónica del tablero y sensores con fallas ocasionales.',
      'Suspensión más bien firme; revisar ruidos en tren delantero.',
      'Acabados de interior justos para el uso intensivo.'
    ],
    evitar_si: ['Tablero con testigos encendidos', 'Correa de distribución vencida sin comprobante'],
    que_chequear: [
      'Service al día y estado del embrague.',
      'Funcionamiento de pantalla/tablero y testigos.',
      'Desgaste de neumáticos y tren delantero.'
    ],
    precio_orientativo: 'Validá contra el feed: el rango depende mucho de año, km y versión.'
  },
  'volkswagen polo': {
    resumen: 'Hatch del segmento B (gen MQB 2018+). Sólido, buen andar y reventa firme.',
    versiones: [
      { nombre: 'Trendline', detalle: 'Base, motor 1.6 MSI nafta.' },
      { nombre: 'Comfortline', detalle: 'La más buscada en usados.' },
      { nombre: 'Highline', detalle: 'Tope, más equipamiento.' },
      { nombre: 'GTS', detalle: 'Deportiva, 1.4 TSI turbo; pide mejor mantenimiento.' }
    ],
    equipamiento: [
      {
        nombre: 'Distribución',
        valor: 'Cadena (1.6 MSI)',
        explicacion_coloquial: 'No tenés que cambiar correa cada 60 mil — una ventaja grande vs muchos rivales.'
      }
    ],
    seguridad: {
      airbags: '6 airbags en versiones medias/altas',
      ncap_estrellas: '5 estrellas Latin NCAP (gen MQB)',
      esp: true,
      explicacion_coloquial: 'De los más seguros del segmento chico-mediano.'
    },
    problemas_comunes: [
      'El 1.6 MSI es simple y confiable; el 1.4 TSI exige service prolijo.',
      'Sensores/electrónica con fallas puntuales.'
    ],
    evitar_si: ['TSI sin historial de service en concesionario o especialista'],
    que_chequear: [
      'Historial de service (sobre todo en GTS/TSI).',
      'Estado de embrague y caja.',
      'Testigos electrónicos y multimedia.'
    ],
    precio_orientativo: 'Reventa firme; suele pedirse un poco más que rivales directos.'
  },
  'toyota corolla': {
    resumen: 'Sedán C de referencia: confiable y con la mejor reventa del segmento. CVT desde 2014.',
    versiones: [
      { nombre: 'XLI', detalle: 'Base.' },
      { nombre: 'XEI', detalle: 'La más vendida; buen equilibrio.' },
      { nombre: 'SEG', detalle: 'Tope de gama.' },
      { nombre: 'Hybrid (2020+)', detalle: 'Híbrido, muy eficiente en ciudad.' }
    ],
    seguridad: {
      airbags: '6+ según versión',
      ncap_estrellas: '5 estrellas Latin NCAP (gen reciente)',
      esp: true,
      explicacion_coloquial: 'Muy sólido en seguridad para el segmento.'
    },
    problemas_comunes: [
      'Caja CVT: muy confiable si tuvo buen mantenimiento; evitá unidades maltratadas o con mucho km sin service de caja.',
      'En general pocas fallas; lo caro es que se paga la marca.'
    ],
    evitar_si: ['CVT con patinaje, olor a quemado o sin service de transmisión documentado'],
    que_chequear: [
      'Service oficial al día (sobre todo CVT).',
      'Comportamiento de la CVT en frío y en aceleración.',
      'Estado de frenos y neumáticos.'
    ],
    precio_orientativo: 'Suele estar por encima del promedio del segmento por su reventa.'
  },
  'toyota hilux': {
    resumen: 'Pickup mediana líder en AR. Reventa altísima y fama de durabilidad. Diésel 2.4/2.8.',
    versiones: [
      { nombre: 'DX', detalle: 'Trabajo, equipamiento básico, muchas veces 4x2.' },
      { nombre: 'SR', detalle: 'Intermedia.' },
      { nombre: 'SRV', detalle: 'La más buscada (confort + 4x4).' },
      { nombre: 'SRX / GR-S', detalle: 'Tope de gama.' }
    ],
    problemas_comunes: [
      'Algunas 2.8 reportaron temas de inyectores: clave el historial de service.',
      'Uso urbano puede ensuciar admisión/EGR por hollín.',
      'Ojo con unidades de uso intensivo off-road o de trabajo pesado.'
    ],
    evitar_si: ['Humo negro persistente, inyectores sin diagnóstico, uso extremo off-road sin mantenimiento'],
    que_chequear: [
      'Historial de service y uso (ruta vs. campo/obra).',
      'Estado de inyectores y humo de escape.',
      'Chasis y bajos si tuvo uso off-road.'
    ],
    precio_orientativo: 'De las que mejor mantienen valor; cuesta encontrar gangas reales.'
  },
  'renault sandero': {
    resumen: 'Hatch económico, espacioso para su precio y barato de mantener. Buen primer auto.',
    versiones: [
      { nombre: 'Authentique / Life', detalle: 'Base.' },
      { nombre: 'Expression / Privilège / Intens', detalle: 'Más equipamiento.' },
      { nombre: 'Stepway', detalle: 'Versión crossover, más despeje.' },
      { nombre: 'RS', detalle: 'Deportiva 2.0; pide manejo y mantenimiento más exigente.' }
    ],
    problemas_comunes: [
      'Electrónica y tablero con fallas ocasionales.',
      'Plásticos y terminaciones justas.',
      'Según motor, atención a la distribución.'
    ],
    evitar_si: ['Motor 1.6 8v con correa bañada en aceite sin historial (reportes de roturas prematuras en AR)'],
    que_chequear: [
      'Tipo y estado de distribución (correa según motor).',
      'Electrónica, levantavidrios y tablero.',
      'Estado de embrague y suspensión.'
    ],
    precio_orientativo: 'Barato de entrada y de mantener; muy buena oferta de usados.'
  }
};

export function getCuratedKnowledge(marca, modelo, anio) {
  const m = normalizeText(modelo);
  const b = normalizeText(marca);
  if (!m) return null;

  if (anio) {
    const yearKey = `${b} ${m} ${anio}`.trim();
    if (CURATED[yearKey]) return CURATED[yearKey];
    const yearKey2 = `${b} ${m}`.trim() + ` ${anio}`;
    if (CURATED[yearKey2]) return CURATED[yearKey2];
    if (b.includes('ford') && m === 'ka' && Number(anio) <= 2014) return CURATED['ford ka 2013'];
  }

  const byPair = CURATED[`${b} ${m}`.trim()];
  if (byPair) return byPair;

  const hit = Object.entries(CURATED).find(([k]) => k.endsWith(` ${m}`) || k === m);
  return hit ? hit[1] : null;
}

export function hasCurated(marca, modelo, anio) {
  return Boolean(getCuratedKnowledge(marca, modelo, anio));
}
