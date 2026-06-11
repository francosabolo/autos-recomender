// lib/transaction-guide.js
// Guía práctica compra/venta de usados en Argentina (sin asesoramiento legal).

import { CHECKLIST_KEYS, CHECKLIST_LABELS } from './checklist.js';

/** @type {{ titulo: string, aviso: string, secciones: Array<{ id: string, titulo: string, items: string[] }> }} */
export const TRANSACTION_GUIDE = {
  titulo: 'Compra y venta de usado — documentación y dinero',
  aviso:
    'Guía orientativa para particulares en Argentina. Los requisitos pueden variar por provincia y por si el auto tiene prenda o inhibición. Ante dudas, consultá un gestor o registro automotor.',
  secciones: [
    {
      id: 'antes',
      titulo: 'Antes de cerrar',
      items: [
        'Coordiná una visita de día y con buena luz; probá ruta y ciudad (frenos, caja, dirección, aire).',
        'Pedí el historial que tenga: facturas de service, cambio de correa/distribución, neumáticos y batería.',
        'Consultá el dominio en el registro o con un gestor: titular, prenda, inhibición, deudas y multas.',
        'Si el precio es muy bajo, desconfiá: puede haber deuda, choque no declarado o documentación incompleta.'
      ]
    },
    {
      id: 'papeles_auto',
      titulo: 'Papeles del auto',
      items: [
        'Cédula de identificación del vehículo (verde o azul según año) a nombre del vendedor.',
        'Título o certificado de dominio / formulario de titularidad vigente.',
        'VTV o RTO al día (o turno cercano si negociás el trámite).',
        'Libre deuda de patentes y multas (consulta en rentas de la provincia o gestoría).',
        'Si es importado o hubo cambios: verificar que coincidan motor, chasis y dominio con la cédula.',
        'Duplicado de llaves y manuales (no es obligatorio pero suma valor).'
      ]
    },
    {
      id: 'papeles_partes',
      titulo: 'Documentación de comprador y vendedor',
      items: [
        'DNI original y vigente de ambas partes (o pasaporte + residencia si aplica).',
        'CUIT/CUIL si alguno factura o firma como monotributista (según el caso).',
        'Comprobante de domicilio reciente si el registro lo pide en tu jurisdicción.',
        'Si compra o vende un tercero: poder notarial o autorización firmada con DNI del titular.'
      ]
    },
    {
      id: 'dinero',
      titulo: 'El dinero: cómo y dónde',
      items: [
        'Evitá entregar efectivo en la calle o en un estacionamiento. Es el punto más riesgoso del negocio.',
        'Lo más seguro: transferencia bancaria inmediata (CBU/CVU/alias) y que ambos vean el acreditado antes de entregar llaves y papeles.',
        'Para montos altos: coordiná el pago en una sucursal bancaria o con escribano (boleto de compraventa + acta de entrega de suma).',
        'Si usás efectivo: contalo adentro del banco o en un lugar cerrado con cámaras; no lo muestres en la vía pública.',
        'No firmes transferencia ni entregues el auto hasta tener el dinero acreditado o el efectivo contado y verificado.',
        'Guardá comprobante de transferencia, captura del home banking o recibo firmado por el vendedor.'
      ]
    },
    {
      id: 'boleto',
      titulo: 'Boleto de compraventa',
      items: [
        'Aunque sea entre particulares, conviene un boleto simple: dominio, marca/modelo, año, km, precio, forma de pago y fecha.',
        'Dejá asentado que el auto se entrega libre de multas y deudas hasta la fecha, y quién paga la transferencia.',
        'Ambos firman; cada uno se queda una copia. Podés usar modelo de gestoría o escribano.',
        'Si pagás seña, aclará si es reintegrable, plazo para el saldo y qué pasa si alguien se echa atrás.'
      ]
    },
    {
      id: 'transferencia',
      titulo: 'Transferencia en el registro',
      items: [
        'Con turno en registro automotor o gestoría autorizada de tu provincia.',
        'Formulario de transferencia (tradición 08 u equivalente local), firmado por comprador y vendedor.',
        'Verificación de dominio, libre deuda y VTV/RTO según exija el organismo.',
        'Pago de aranceles de transferencia y sellados (suele pagar el comprador salvo pacto distinto).',
        'Alta del seguro obligatorio a tu nombre antes o al momento de transferir (según provincia).',
        'Recién cuando la transferencia está en trámite o terminada, considerá cerrado el negocio.'
      ]
    },
    {
      id: 'vendedor',
      titulo: 'Si estás vendiendo',
      items: [
        'No entregues cédula ni llaves hasta cobrar y dejar constancia (transferencia o boleto + pago verificado).',
        'Avisá al comprador si hay deuda de patente: definan quién la paga antes de transferir.',
        'Sacá fotos del estado del auto y del odómetro el día de la entrega.',
        'Después de transferido, guardá copia del boleto y del comprobante por si surge un reclamo posterior.'
      ]
    }
  ]
};

/** Pasos resumidos para el brief del asesor y el panel al contactar. */
export function buildGuiaCompraPasos() {
  return {
    resumen:
      'Cuando contactes un vendedor: primero validá la unidad, después boleto y pago seguro, y recién ahí la transferencia en el registro. No entregues dinero sin constancia firmada.',
    pasos: [
      {
        id: 'unidad',
        titulo: '1. Revisar la unidad en persona',
        destacado: 'Usá el checklist de abajo en cada aviso contactado.',
        items: TRANSACTION_GUIDE.secciones.find(s => s.id === 'antes')?.items?.slice(0, 3) || []
      },
      {
        id: 'papeles',
        titulo: '2. Pedir papeles antes de ofertar',
        items: [
          ...(TRANSACTION_GUIDE.secciones.find(s => s.id === 'papeles_auto')?.items?.slice(0, 4) || []),
          'DNI del titular y que coincida con la cédula del auto.'
        ]
      },
      {
        id: 'boleto',
        titulo: '3. Firmar boleto de compraventa',
        destacado:
          'Entre particulares conviene igual: dominio, marca/modelo, año, km, precio, forma de pago, fecha y que el auto se entrega libre de multas.',
        items: TRANSACTION_GUIDE.secciones.find(s => s.id === 'boleto')?.items || []
      },
      {
        id: 'dinero',
        titulo: '4. Pagar con seguridad',
        destacado: 'Transferencia acreditada antes de llevarse llaves y cédula. Evitá efectivo en la calle.',
        items: TRANSACTION_GUIDE.secciones.find(s => s.id === 'dinero')?.items?.slice(0, 4) || []
      },
      {
        id: 'transferencia',
        titulo: '5. Transferir en el registro',
        items: TRANSACTION_GUIDE.secciones.find(s => s.id === 'transferencia')?.items || []
      }
    ]
  };
}

export function getUnitChecklistMeta() {
  return { keys: [...CHECKLIST_KEYS], labels: { ...CHECKLIST_LABELS } };
}

export function getTransactionGuide() {
  return TRANSACTION_GUIDE;
}

/** Payload completo para API y brief. */
export function getTransactionGuidePayload() {
  return {
    ...TRANSACTION_GUIDE,
    guia_compra: buildGuiaCompraPasos(),
    checklist_unidad: getUnitChecklistMeta()
  };
}

/** Agrega guía de trámite al brief del asesor si no viene del LLM. */
export function enrichBriefWithTramite(brief) {
  if (!brief || typeof brief !== 'object') return brief;
  return {
    ...brief,
    guia_compra: brief.guia_compra || buildGuiaCompraPasos()
  };
}
