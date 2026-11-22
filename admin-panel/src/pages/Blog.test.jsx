// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import Blog from './Blog'
import styles from './Blog.module.css'
import imageStyles from '../components/blog/BlogImages.module.css'

const COVER = 'https://demo.supabase.co/storage/v1/object/public/blog-media/c/p/cover.webp'
const mocks = vi.hoisted(() => ({
  service: {
    getPosts: vi.fn(), getPostMedia: vi.fn(), createPost: vi.fn(), updatePost: vi.fn(), syncImages: vi.fn(),
  },
  toast: { success: vi.fn(), error: vi.fn() },
}))
vi.mock('../contexts/CompanyContext', () => ({ useCompany: () => ({ selectedCompany: { id: 'company-a', name: 'Arquelia' } }) }))
vi.mock('../contexts/FeedbackContext', () => ({ useFeedback: () => ({ toast: mocks.toast }) }))
vi.mock('../contexts/LanguageContext', () => ({ useLanguage: () => ({ t: key => key }) }))
vi.mock('../hooks/usePermissions', () => ({ usePermissions: () => ({ canEdit: true }) }))
vi.mock('../services/blogService', () => ({ blogService: mocks.service, BLOG_MAX_IMAGES: 3 }))
vi.mock('../lib/imageCompression', () => ({ compressToWebP: async file => Object.assign(new File([file], 'x.webp', { type: 'image/webp' }), { width: 1600, height: 1000 }) }))
// El editor real (Tiptap) tiene sus propias pruebas de serialización; aquí basta un campo de texto.
vi.mock('../components/blog/RichTextEditor', () => ({
  default: ({ id, value, onChange }) => <textarea id={id} value={value} onChange={event => onChange(event.target.value)} />,
}))

let root, host
const setValue = async (element, value) => act(async () => {
  const proto = element.tagName === 'SELECT' ? HTMLSelectElement.prototype : element.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype
  Object.getOwnPropertyDescriptor(proto, 'value').set.call(element, value)
  element.dispatchEvent(new Event('input', { bubbles: true }))
  element.dispatchEvent(new Event('change', { bubbles: true }))
})
const click = async element => act(async () => element.click())
const button = text => [...host.querySelectorAll('button')].find(item => item.textContent.includes(text))
const addImage = async () => {
  const input = host.querySelector('input[type=file]')
  Object.defineProperty(input, 'files', { configurable: true, value: [new File(['a'], 'foto.jpg', { type: 'image/jpeg' })] })
  await act(async () => { input.dispatchEvent(new Event('change', { bubbles: true })) })
}
const fillPost = async () => {
  await setValue(host.querySelector('#blog-title'), 'Cómo reformar una cocina pequeña sin obras')
  await setValue(host.querySelector('#blog-intro'), 'Ideas prácticas para ganar espacio y luz en una cocina pequeña sin meterse en obras grandes ni gastar de más.')
  await setValue(host.querySelector('#blog-body'), '## Antes de empezar\n\nMide bien el espacio.')
  await setValue(host.querySelector('#blog-status'), 'published')
}
const submit = async () => act(async () => host.querySelector('form').requestSubmit())

beforeEach(async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  URL.createObjectURL = vi.fn(() => `blob:preview-${Math.random()}`)
  URL.revokeObjectURL = vi.fn()
  mocks.service.getPosts.mockResolvedValue([{ id: 'other', slug: 'como-reformar-cocina-pequena-sin-obras', title: 'Otro', status: 'draft', created_at: '2026-01-01' }])
  mocks.service.createPost.mockImplementation(async data => ({ id: 'post-1', ...data, created_at: '2026-11-21' }))
  mocks.service.updatePost.mockImplementation(async (id, data) => ({ id, ...data, published_at: data.status === 'published' ? '2026-11-21' : null }))
  mocks.service.syncImages.mockResolvedValue([{ id: 'media-1', url_externa: COVER, alt_text: 'Cómo reformar una cocina pequeña sin obras', is_cover_image: true }])
  host = document.createElement('div'); document.body.append(host); root = createRoot(host)
  await act(async () => root.render(<Blog />))
  await click(button('blog.newPost'))
})
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.clearAllMocks(); vi.unstubAllGlobals() })

it('defines every CSS Module class used by the blog editor', () => {
  for (const name of ['editor', 'checklist', 'checkOk', 'checkTodo', 'postCover', 'postText', 'formError']) expect(styles[name], name).toBeTruthy()
  for (const name of ['grid', 'card', 'isCover', 'badge', 'empty', 'actions']) expect(imageStyles[name], name).toBeTruthy()
})

it('does not publish an article without images and keeps what was written', async () => {
  await fillPost()
  await submit()
  expect(mocks.service.createPost).not.toHaveBeenCalled()
  expect(host.querySelector('[role=alert]').textContent).toBe('blog.images.requiredToPublish')
  expect(host.querySelector('#blog-title').value).toBe('Cómo reformar una cocina pequeña sin obras')
})

it('saves as draft, uploads the images and then publishes with automatic SEO and the cover as sharing image', async () => {
  await fillPost()
  await addImage()
  expect(host.textContent).toContain('blog.images.pending')
  await submit()

  const created = mocks.service.createPost.mock.calls[0][0]
  expect(created).toMatchObject({ company_id: 'company-a', status: 'draft', seo_og_image_url: null })
  expect(created.slug).toBe('como-reformar-cocina-pequena-sin-obras-2') // único dentro de la empresa
  expect(created.seo_title).toBe('Cómo reformar una cocina pequeña sin obras | Arquelia')
  expect(created.seo_description.length).toBeLessThanOrEqual(155)

  const [, postId, images] = mocks.service.syncImages.mock.calls[0]
  expect(postId).toBe('post-1')
  expect(images).toHaveLength(1)
  expect(images[0]).toMatchObject({ is_cover_image: true, alt_text: 'Cómo reformar una cocina pequeña sin obras' })

  expect(mocks.service.updatePost).toHaveBeenLastCalledWith('post-1', { status: 'published', seo_og_image_url: COVER })
  expect(mocks.toast.success).toHaveBeenCalledWith('blog.created')
})

it('retries a failed image upload on the same article instead of creating a duplicate', async () => {
  await fillPost()
  await addImage()
  mocks.service.syncImages.mockRejectedValueOnce(Object.assign(new Error('network'), { saved: [] }))
  mocks.service.getPostMedia.mockResolvedValue([])
  await submit()
  expect(host.querySelector('[role=alert]').textContent).toBe('blog.images.saveError')
  expect(host.querySelector('#blog-title').value).toBe('Cómo reformar una cocina pequeña sin obras')

  await submit()
  expect(mocks.service.createPost).toHaveBeenCalledTimes(1)
  expect(mocks.service.updatePost).toHaveBeenCalledWith('post-1', expect.objectContaining({ status: 'draft', slug: 'como-reformar-cocina-pequena-sin-obras-2' }))
  expect(mocks.service.syncImages).toHaveBeenCalledTimes(2)
  expect(mocks.service.updatePost).toHaveBeenLastCalledWith('post-1', { status: 'published', seo_og_image_url: COVER })
})

it('avisa de los artículos sin dirección en vez de enseñar su id interno', async () => {
  mocks.service.getPosts.mockResolvedValue([
    { id: '2ce79b99-67cc-93bb-65aa-d6732e8365c0', slug: null, title: 'Publicado sin slug', status: 'published', created_at: '2026-01-01' },
    { id: '54dac409-3dc5-4717-f3e2-339c47620d4f', slug: null, title: 'Borrador sin slug', status: 'draft', created_at: '2026-01-01' },
    { id: 'p3', slug: 'con-direccion', title: 'Con dirección', status: 'published', created_at: '2026-01-01' },
  ])
  await act(async () => root.unmount())
  root = createRoot(host)
  await act(async () => root.render(<Blog />))
  const text = host.textContent
  expect(text).not.toContain('2ce79b99')
  expect(text).not.toContain('54dac409')
  expect(text).toContain('blog.noSlugPublished')
  expect(text).toContain('blog.noSlug')
  expect(text).toContain('/con-direccion')
})
