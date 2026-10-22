import { describe, expect, it } from 'vitest'
import { mergeAttachments, orphanPaths, removeAttachment } from './attachments'

const a = { name: 'contrato.pdf', path: 'tasks/a.pdf' }
const b = { name: 'plano.png', path: 'tasks/b.png' }
const c = { name: 'nuevo.pdf', path: 'tasks/c.pdf' }

describe('attachments — editar una tarea ya no borra los adjuntos', () => {
  it('los que ya estaban se conservan y los nuevos se añaden', () => {
    expect(mergeAttachments([a, b], [c])).toEqual([a, b, c])
  })

  it('subir dos veces el mismo archivo no lo duplica', () => {
    expect(mergeAttachments([a], [a, c])).toEqual([a, c])
  })

  it('sin archivos nuevos, se queda como estaba', () => {
    expect(mergeAttachments([a, b], [])).toEqual([a, b])
    expect(mergeAttachments(undefined, undefined)).toEqual([])
  })

  it('quitar uno es explícito y no toca a los demás', () => {
    expect(removeAttachment([a, b, c], 1)).toEqual([a, c])
  })

  it('identifica los archivos que quedan huérfanos en el bucket', () => {
    expect(orphanPaths([a, b], [a])).toEqual(['tasks/b.png'])
    expect(orphanPaths([a], [a])).toEqual([])
  })
})


describe('legacy attachment URL safety', () => {
  it('recovers only paths from the configured Supabase project', async () => {
    const { plannerAttachmentPath } = await import('./attachments')
    const endpoint='https://own-project.supabase.co'
    expect(plannerAttachmentPath({ url:`${endpoint}/storage/v1/object/public/media-planner/tasks/a.pdf` },endpoint)).toBe('tasks/a.pdf')
    expect(plannerAttachmentPath({ path:'company/tasks/a.pdf' },endpoint)).toBe('company/tasks/a.pdf')
    for (const url of ['javascript:alert(1)','data:text/html,<script>alert(1)</script>','https://other-project.supabase.co/storage/v1/object/public/media-planner/tasks/a.pdf','https://evil.example/a.pdf']) {
      expect(plannerAttachmentPath({ url },endpoint)).toBeNull()
    }
  })
})
