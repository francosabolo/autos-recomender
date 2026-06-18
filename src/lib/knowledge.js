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

/** Catálogo jerárquico: marca → modelo → generación (años) → versión. */
const CATALOGS = {
  'volkswagen|polo': {
    marca: 'Volkswagen',
    modelo: 'Polo',
    resumen: 'Hatch segmento B. En usados hasta ~$20M domina la generación MQB; la línea Track (2020-2024) es la más buscada en ciudad.',
    distribucion_resumen: 'El 1.6 MSI usa cadena — no correa cada 60-80 mil km.',
    evitar_si: ['TSI turbo sin service documentado'],
    precio_orientativo_usado: 'Track 2020-2022: validá km y service en el tablero.',
    generaciones: [
      {
        id: 'polo-vi-track',
        nombre: 'Polo VI · Track',
        anio_desde: 2018,
        anio_hasta: 2024,
        notas: 'Línea urbana con estética aventura; mismo 1.6 MSI que el resto de la gama MQB.',
        versiones: [
          {
            version: 'Track MSI',
            motor: '1.6 MSI nafta',
            potencia_cv: 110,
            distribucion: 'Cadena',
            transmision: 'Manual 5 vel / I-Motion 6 vel',
            ncap: '5 estrellas Latin NCAP',
            destacado: 'Mejor reventa del segmento; mecánica simple.',
            por_anio: [
              {
                anio_desde: 2018,
                anio_hasta: 2022,
                airbags: '4',
                esp: false,
                nota: 'Sin ESP en Argentina hasta MY 2022 inclusive (Track MSI).',
                meta: { source: 'curated', confidence: 0.95, refs: ['Latin NCAP', 'ficha oficial VW AR'] }
              },
              {
                anio_desde: 2023,
                anio_hasta: 2024,
                airbags: '4',
                esp: true,
                nota: 'ESP de serie desde MY 2023.',
                meta: { source: 'curated', confidence: 0.9, refs: ['Latin NCAP'] }
              }
            ]
          }
        ]
      },
      {
        nombre: 'Polo VI · Comfortline / Highline',
        anio_desde: 2018,
        anio_hasta: 2019,
        versiones: [
          {
            version: 'Comfortline 1.6 MSI',
            anio_desde: 2018,
            anio_hasta: 2019,
            motor: '1.6 MSI',
            potencia_cv: 110,
            distribucion: 'Cadena',
            airbags: '6',
            esp: true,
            destacado: 'Más equipamiento que Track; mismo motor.'
          },
          {
            version: 'Highline 1.6 MSI',
            anio_desde: 2018,
            anio_hasta: 2019,
            motor: '1.6 MSI',
            potencia_cv: 110,
            distribucion: 'Cadena',
            airbags: '6',
            esp: true,
            destacado: 'Tope de gama de la gen MQB inicial.'
          }
        ]
      }
    ]
  },
  'fiat|argo': {
    marca: 'Fiat',
    modelo: 'Argo',
    resumen: 'Hatch nacional desde 2017. Las versiones Drive y Precision son las que más ves en usados.',
    evitar_si: ['Sin comprobante de cambio de correa'],
    precio_orientativo_usado: 'Muy competitivo en ciudad; Precision pide más pero trae más equipo.',
    generaciones: [
      {
        nombre: 'Argo nacional',
        anio_desde: 2017,
        anio_hasta: 2025,
        versiones: [
          {
            version: 'Drive',
            anio_desde: 2017,
            anio_hasta: 2025,
            motor: '1.3 Firefly',
            potencia_cv: 99,
            distribucion: 'Correa',
            transmision: 'Manual 5 vel',
            airbags: '2 frontales',
            esp: false,
            destacado: 'Entrada de gama; ideal ciudad.'
          },
          {
            version: 'Precision',
            anio_desde: 2017,
            anio_hasta: 2025,
            motor: '1.8 E.torQ',
            potencia_cv: 130,
            distribucion: 'Correa',
            transmision: 'Manual 5 vel / CVT (según año)',
            airbags: '4',
            esp: true,
            destacado: 'Más potencia y equipamiento; revisá correa.'
          },
          {
            version: 'HGT 1.8',
            anio_desde: 2019,
            anio_hasta: 2022,
            motor: '1.8 E.torQ',
            potencia_cv: 130,
            distribucion: 'Correa',
            airbags: '4',
            esp: true,
            destacado: 'Versión deportiva; misma mecánica que Precision.'
          }
        ]
      }
    ]
  },
  'ford|ka': {
    marca: 'Ford',
    modelo: 'Ka',
    resumen:
      'Hatch/sedán urbano (Ka III, 2018+). Mecánica 1.5 Sigma simple y repuestos accesibles. Clave: hasta 2021 no trae ESP; desde 2022 sí (obligatorio en AR).',
    distribucion_resumen: '1.5 Sigma: correa de distribución — pedí comprobante de cambio (~60-80 mil km).',
    evitar_si: [
      'Buscás ESP y el auto es 2021 o anterior',
      'Correa de distribución vencida sin factura',
      'Tablero con testigos encendidos'
    ],
    precio_orientativo_usado: 'SE 2019-2021 suele ser la más ofertada; 2022+ pide más por ESP y más airbags.',
    generaciones: [
      {
        nombre: 'Ka III · hatch / sedán',
        anio_desde: 2018,
        anio_hasta: 2024,
        notas: 'ESP de serie solo desde año modelo 2022 en Argentina (unidades 2021 = sin ESP).',
        versiones: [
          {
            version: 'S / SE',
            motor: '1.5 Sigma nafta',
            potencia_cv: 98,
            distribucion: 'Correa',
            transmision: 'Manual 5 vel',
            por_anio: [
              {
                anio_desde: 2018,
                anio_hasta: 2021,
                airbags: '2 frontales',
                esp: false,
                ncap: '3 estrellas Latin NCAP (aprox.)',
                nota: 'Sin ESP en ninguna versión hasta 2021 inclusive — ojo en lluvia o ruta.'
              },
              {
                anio_desde: 2022,
                anio_hasta: 2024,
                airbags: '4 en SE en adelante',
                esp: true,
                ncap: '3 estrellas Latin NCAP (aprox.)',
                nota: 'ESP de serie desde 2022; validá que el año del título sea 2022+.'
              }
            ]
          },
          {
            version: 'SE Plus / SEL / Titanium',
            motor: '1.5 Sigma nafta',
            potencia_cv: 98,
            distribucion: 'Correa',
            transmision: 'Manual 5 vel / automática (según año)',
            por_anio: [
              {
                anio_desde: 2018,
                anio_hasta: 2021,
                airbags: '2-4 según año',
                esp: false,
                destacado: 'Más equipo (clima, pantalla) pero sin ESP hasta 2021.'
              },
              {
                anio_desde: 2022,
                anio_hasta: 2024,
                airbags: '4',
                esp: true,
                destacado: 'Mejor equipamiento + ESP; la que conviene si manejás ruta.'
              }
            ]
          },
          {
            version: 'Freestyle',
            motor: '1.5 Sigma nafta',
            potencia_cv: 98,
            distribucion: 'Correa',
            por_anio: [
              { anio_desde: 2018, anio_hasta: 2021, esp: false, nota: 'Versión aventura; mismo esquema de seguridad pre-2022.' },
              { anio_desde: 2022, anio_hasta: 2024, esp: true, nota: 'Freestyle con ESP desde 2022.' }
            ]
          }
        ]
      }
    ]
  },
  'renault|sandero': {
    marca: 'Renault',
    modelo: 'Sandero',
    resumen: 'Hatch espacioso y económico. Sandero II (2016+) y Stepway comparten plataforma.',
    evitar_si: ['Correa bañada en aceite sin historial (1.6 8v)'],
    precio_orientativo_usado: 'De los más accesibles; validá versión y motor.',
    generaciones: [
      {
        nombre: 'Sandero II',
        anio_desde: 2016,
        anio_hasta: 2024,
        versiones: [
          {
            version: 'Life / Expression',
            motor: '1.6 16v',
            potencia_cv: 110,
            distribucion: 'Correa',
            airbags: '2-4 según año',
            esp: false,
            destacado: 'Mucho espacio por el precio.'
          },
          {
            version: 'Intens',
            motor: '1.6 16v',
            potencia_cv: 110,
            airbags: '4',
            esp: true,
            destacado: 'Mejor equipamiento de la línea hatch.'
          }
        ]
      },
      {
        nombre: 'Stepway',
        anio_desde: 2016,
        anio_hasta: 2024,
        notas: 'Crossover urbano sobre base Sandero.',
        versiones: [
          {
            version: 'Stepway Intens',
            motor: '1.6 16v',
            potencia_cv: 110,
            destacado: 'Más despeje; mismo esquema mecánico.'
          }
        ]
      }
    ]
  }
};

export function getCuratedCatalog(marca, modelo) {
  const key = `${normalizeText(marca)}|${normalizeText(modelo)}`;
  return CATALOGS[key] || null;
}

/** @deprecated */
export function getCuratedProfile(marca, modelo) {
  return getCuratedCatalog(marca, modelo);
}
