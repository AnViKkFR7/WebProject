# Snippets para las webs de empresa

Código que se copia en el proyecto de **cada web de cliente** que consuma el
backend de moira ordo.

| Qué | Archivos | Instrucciones |
|---|---|---|
| **Analítica** (visitas y clics, sin cookies) | `lib/trackCore.ts`, `lib/analytics.ts`, `lib/consent.ts`, `api/track.ts` | [`ANALYTICS_INTEGRATION.md`](./ANALYTICS_INTEGRATION.md) |
| **Bandeja de solicitudes** (formulario de contacto) | `lib/leads.ts`, `api/lead.ts` | [`LEADS_INTEGRATION.md`](./LEADS_INTEGRATION.md) |

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
