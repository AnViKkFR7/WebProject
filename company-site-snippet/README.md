# Snippets para las webs de empresa

Código que se copia en el proyecto de **cada web de cliente** que consuma el
backend de moira ordo.

Para una implementación completa desde cero, empezar por
[`MoiraOrdoCRMStartingDocument.md`](./MoiraOrdoCRMStartingDocument.md). Este
documento resume qué debe integrar una web nueva, qué permanece en Admin y
remite a los contratos técnicos específicos de cada función.

| Qué | Archivos | Instrucciones |
|---|---|---|
| **Catálogo de items y SEO público** | `items` + `item_media` (solo lectura pública) | [`ITEMS_SEO_INTEGRATION.md`](./ITEMS_SEO_INTEGRATION.md) |
| **Analítica** (visitas y clics, sin cookies) | `lib/trackCore.ts`, `lib/analytics.ts`, `lib/consent.ts`, `api/track.ts` | [`ANALYTICS_INTEGRATION.md`](./ANALYTICS_INTEGRATION.md) |
| **Bandeja de solicitudes** (formulario de contacto) | `lib/leads.ts`, `api/lead.ts` | [`LEADS_INTEGRATION.md`](./LEADS_INTEGRATION.md) |

Para migrar una web SPA existente a URLs y metadatos SEO por item, seguir el
[`roadmap de migración SEO`](./ITEMS_SEO_MIGRATION_ROADMAP.md). Los SQL están en
[`database/maintenance/ITEMS_SEO_PREFLIGHT.sql`](../database/maintenance/ITEMS_SEO_PREFLIGHT.sql)
(solo lectura) y
[`database/templates/ITEMS_SEO_VALUES_TEMPLATE.sql`](../database/templates/ITEMS_SEO_VALUES_TEMPLATE.sql)
(escritura, una vez rellenado y revisado); se ejecutan manualmente en el Supabase
de cada sitio, nunca desde el chat de IA.

Las dos comparten `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` y
`VITE_COMPANY_ID`: si una ya está integrada, la otra solo añade sus archivos.
La analítica necesita además `ANALYTICS_SALT`.

---

## Probar los snippets

La lógica compartida (`lib/trackCore.ts`, `lib/consent.ts`) tiene tests. Se
ejecutan con el vitest del panel, desde `admin-panel/`:

```bash
npm test
```
