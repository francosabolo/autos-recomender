import { z } from 'zod';

const ChatMessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string().min(1).max(32000)
});

const ContextoSchema = z
  .object({
    autoActual: z.string().max(2000).nullable().optional(),
    ciudad: z.string().max(200).nullable().optional(),
    provincia: z.string().max(200).nullable().optional(),
    presupuesto: z.string().max(2000).nullable().optional(),
    // Lo que el usuario está viendo en el ojeador en este momento.
    feedResumen: z.string().max(8000).nullable().optional(),
    tableroActivo: z.string().max(8000).nullable().optional()
  })
  .strict()
  .optional();

const ChatRequestSchema = z
  .object({
    messages: z.array(ChatMessageSchema).min(1).max(200),
    contexto: ContextoSchema,
    sessionId: z.string().uuid().optional()
  })
  .strict();

const SearchFiltersSchema = z
  .object({
    query: z.string().max(500).optional(),
    marca: z.string().max(80).nullable().optional(),
    modelo: z.string().max(80).nullable().optional(),
    combustible: z.enum(['diesel', 'nafta', 'hibrido', 'electrico']).nullable().optional(),
    traccion: z.enum(['4x2', '4x4']).nullable().optional(),
    transmision: z.enum(['manual', 'automatico']).nullable().optional(),
    tipo: z.enum(['sedan', 'hatchback', 'suv', 'pickup', 'familiar', 'monovolumen', 'coupe', 'furgon']).nullable().optional(),
    precioMin: z.number().int().min(0).nullable().optional(),
    precioMax: z.number().int().min(0).nullable().optional(),
    anioMin: z.number().int().min(1950).max(2100).nullable().optional(),
    anioMax: z.number().int().min(1950).max(2100).nullable().optional(),
    ciudad: z.string().max(120).nullable().optional(),
    provincia: z.string().max(120).nullable().optional()
  })
  .strict()
  .optional();

const SearchRequestSchema = z
  .object({
    query: z.string().max(500).optional(),
    filters: SearchFiltersSchema,
    portalIds: z.array(z.string().max(80)).min(1).max(12).optional(),
    boardId: z.string().uuid().optional(),
    boardName: z.string().min(1).max(120).optional(),
    limit: z.number().int().min(1).max(80).optional()
  })
  .strict();

const DiscoverRequestSchema = z
  .object({
    query: z.string().max(500).optional(),
    filters: SearchFiltersSchema,
    portalIds: z.array(z.string().max(80)).min(1).max(12).optional(),
    limit: z.number().int().min(1).max(80).optional()
  })
  .strict();

const ListingPayloadSchema = z
  .object({
    id: z.string().max(120).optional(),
    source: z.string().max(80).optional(),
    fuente: z.string().max(120).optional(),
    source_listing_id: z.string().max(160).nullable().optional(),
    titulo: z.string().min(1).max(260),
    title: z.string().max(260).optional(),
    precio: z.number().int().min(0).nullable().optional(),
    price: z.number().int().min(0).nullable().optional(),
    moneda: z.string().max(8).nullable().optional(),
    currency: z.string().max(8).nullable().optional(),
    año: z.number().int().min(1900).max(2100).nullable().optional(),
    anio: z.number().int().min(1900).max(2100).nullable().optional(),
    year: z.number().int().min(1900).max(2100).nullable().optional(),
    kilometros: z.number().int().min(0).nullable().optional(),
    km: z.number().int().min(0).nullable().optional(),
    ubicacion: z.string().max(180).nullable().optional(),
    location: z.string().max(180).nullable().optional(),
    link: z.string().url().max(2000),
    imagen: z.string().url().max(2000).nullable().optional(),
    image: z.string().url().max(2000).nullable().optional(),
    marca: z.string().max(80).nullable().optional(),
    brand: z.string().max(80).nullable().optional(),
    modelo: z.string().max(80).nullable().optional(),
    model: z.string().max(80).nullable().optional(),
    combustible: z.string().max(40).nullable().optional(),
    fuel: z.string().max(40).nullable().optional(),
    traccion: z.string().max(40).nullable().optional(),
    traction: z.string().max(40).nullable().optional(),
    transmision: z.string().max(40).nullable().optional(),
    transmission: z.string().max(40).nullable().optional(),
    insight: z.string().max(500).nullable().optional()
  })
  .passthrough();

const PinListingRequestSchema = z
  .object({
    boardId: z.string().uuid().optional(),
    boardName: z.string().min(1).max(120).optional(),
    listing: ListingPayloadSchema
  })
  .strict()
  .refine(data => data.boardId || data.boardName, {
    message: 'Se requiere boardId o boardName',
    path: ['boardId']
  });

const CreateBoardRequestSchema = z
  .object({
    name: z.string().min(1).max(120),
    description: z.string().max(500).nullable().optional(),
    filters: SearchFiltersSchema,
    portals: z.array(z.string().max(80)).min(1).max(12).optional()
  })
  .strict();

const UpdateBoardRequestSchema = z
  .object({
    name: z.string().min(1).max(120).optional(),
    filters: SearchFiltersSchema,
    portals: z.array(z.string().max(80)).min(1).max(12).optional(),
    alertsEnabled: z.boolean().optional(),
    notes: z.string().max(2000).nullable().optional()
  })
  .strict()
  .refine(d => Object.keys(d).length > 0, { message: 'Nada para actualizar' });

const RefreshBoardRequestSchema = z
  .object({
    limit: z.number().int().min(1).max(80).optional()
  })
  .strict()
  .optional();

const ChecklistItemSchema = z.boolean().nullable();

const ChecklistSchema = z
  .object({
    vtv_ok: ChecklistItemSchema.optional(),
    service_al_dia: ChecklistItemSchema.optional(),
    dueno_unico: ChecklistItemSchema.optional(),
    precio_negociable: ChecklistItemSchema.optional(),
    titular_ok: ChecklistItemSchema.optional(),
    sin_siniestros: ChecklistItemSchema.optional()
  })
  .strict();

const UpdateListingRequestSchema = z
  .object({
    status: z.enum(['saved', 'contacted', 'discarded']).optional(),
    notes: z.string().max(1000).nullable().optional(),
    shortlisted: z.boolean().optional(),
    checklist: ChecklistSchema.optional()
  })
  .strict()
  .refine(d => Object.keys(d).length > 0, { message: 'Nada para actualizar' });

const RecommendSearchRequestSchema = z
  .object({
    query: z.string().min(3).max(500),
    ciudad: z.string().max(120).nullable().optional(),
    provincia: z.string().max(120).nullable().optional(),
    portalIds: z.array(z.string().max(80)).min(1).max(12).optional(),
    limit: z.number().int().min(1).max(80).optional()
  })
  .strict();

/**
 * @param {unknown} body
 */
export function parseChatRequest(body) {
  const parsed = ChatRequestSchema.safeParse(body);
  if (!parsed.success) {
    const msg = parsed.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ');
    return { ok: false, error: `Payload inválido: ${msg}` };
  }
  return { ok: true, data: parsed.data };
}

function parseWithSchema(schema, body) {
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    const msg = parsed.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ');
    return { ok: false, error: `Payload inválido: ${msg}` };
  }
  return { ok: true, data: parsed.data };
}

export function parseSearchRequest(body) {
  return parseWithSchema(SearchRequestSchema, body);
}

export function parseDiscoverRequest(body) {
  return parseWithSchema(DiscoverRequestSchema, body);
}

export function parsePinListingRequest(body) {
  return parseWithSchema(PinListingRequestSchema, body);
}

export function parseCreateBoardRequest(body) {
  return parseWithSchema(CreateBoardRequestSchema, body);
}

export function parseUpdateBoardRequest(body) {
  return parseWithSchema(UpdateBoardRequestSchema, body);
}

export function parseRefreshBoardRequest(body) {
  return parseWithSchema(RefreshBoardRequestSchema, body ?? {});
}

export function parseUpdateListingRequest(body) {
  return parseWithSchema(UpdateListingRequestSchema, body);
}

export function parseRecommendSearchRequest(body) {
  return parseWithSchema(RecommendSearchRequestSchema, body);
}
