'use client'
import { useState, useEffect } from 'react'
import type { TransactionGuide } from '@/types'

export function GuidePane() {
  const [guide, setGuide] = useState<TransactionGuide | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/transaction-guide')
      .then(r => r.json())
      .then(data => { if (data.ok) setGuide(data.guide) })
      .catch(() => setGuide(FALLBACK_GUIDE))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return <div style={{ padding: 32, textAlign: 'center' }}><div className="spinner" style={{ margin: '0 auto' }} /></div>
  }

  if (!guide) return null

  return (
    <div style={{ padding: 24, maxWidth: 720 }}>
      {guide.titulo && (
        <h2 style={{ fontSize: 20, fontWeight: 800, color: 'var(--ink)', marginBottom: 8 }}>{guide.titulo}</h2>
      )}
      {guide.aviso && (
        <div style={{ background: 'var(--surface-soft)', border: '1px solid var(--primary)', borderLeft: '3px solid var(--primary)', padding: '10px 14px', fontSize: 13, color: 'var(--charcoal)', marginBottom: 20, lineHeight: 1.5 }}>
          {guide.aviso}
        </div>
      )}
      {guide.secciones?.map((section, i) => (
        <div key={i} className="guide-section">
          <div className="guide-section-header">{section.titulo}</div>
          <div className="guide-section-items">
            {section.items.map((item, j) => (
              <div key={j} className="guide-section-item">{item}</div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

const FALLBACK_GUIDE: TransactionGuide = {
  titulo: 'Guía de compra de autos usados',
  aviso: 'Esta guía es orientativa. Siempre consultá con un profesional antes de cerrar cualquier operación.',
  secciones: [
    {
      titulo: '1. Antes de ver el auto',
      items: [
        'Verificá el informe de dominio en el Registro del Automotor (DNRPA)',
        'Pedí el historial de service y revisión técnica obligatoria (VTV)',
        'Consultá el precio promedio de mercado para ese modelo y año',
        'Investigá los problemas conocidos del modelo'
      ]
    },
    {
      titulo: '2. Al ver el auto',
      items: [
        'Revisá la carrocería en busca de golpes, abolladuras o pintura diferente (indicio de choque)',
        'Chequeá el motor: sin ruidos raros, sin humo excesivo, sin pérdidas de aceite',
        'Verificá que todos los vidrios sean originales (buscá el logo del fabricante)',
        'Probá todas las funciones: aire acondicionado, vidrios eléctricos, cierre centralizado',
        'Hacé un test drive en ciudad y autopista',
        'Llevá el auto a una mecánica de confianza para revisión pre-compra'
      ]
    },
    {
      titulo: '3. Documentación y trámites',
      items: [
        'Verificá que el número de chasis y motor coincidan con el título',
        'Asegurate que no tenga deudas de patentes ni multas',
        'Firmá el contrato de compraventa ante escribano público',
        'Realizá la transferencia del automotor en el Registro del Automotor',
        'Contratá el seguro antes de retirar el vehículo'
      ]
    },
    {
      titulo: '4. Negociación',
      items: [
        'Usá el precio de mercado como referencia para negociar',
        'Considerá el estado real del auto, el kilometraje y el historial',
        'Pedí al vendedor que cubra el costo de la transferencia',
        'No entregues dinero sin tener toda la documentación en orden',
        'Si el precio parece demasiado bueno, desconfiá'
      ]
    }
  ]
}
