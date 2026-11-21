import { useEffect, useMemo, useRef, useState } from 'react'
import { useCompany } from '../contexts/CompanyContext'
import { useFeedback } from '../contexts/FeedbackContext'
import { useLanguage } from '../contexts/LanguageContext'
import { usePermissions } from '../hooks/usePermissions'
import { buildSeoPreview, slugify } from '../lib/contentSeo'
import { markdownToText } from '../lib/blogMarkdown'
import { applyAutoSeo, autoAltTexts, BLOG_SEO, seoChecklist } from '../lib/blogSeo'
import { blogService } from '../services/blogService'
import SeoFields from '../components/seo/SeoFields'
import BlogImages from '../components/blog/BlogImages'
import RichTextEditor from '../components/blog/RichTextEditor'
import FormSection from '../components/ui/FormSection'
import PageHeader from '../components/ui/PageHeader'
import EmptyState from '../components/ui/EmptyState'
import Icon from '../components/ui/Icon'
import styles from './Blog.module.css'
import SlidingIndicator from '../components/ui/SlidingIndicator'

const FILTERS = ['all', 'draft', 'published', 'archived']
const EMPTY_FORM = {
  title: '', slug: '', heading: '', intro: '', body: '', status: 'draft',
  seo_title: '', seo_description: '', seo_og_image_url: '',
}

function toForm(post) {
  return {
    ...EMPTY_FORM,
    title: post.title || '', slug: post.slug || '', heading: post.heading || '',
    intro: post.intro || '', body: post.body || '', status: post.status || 'draft',
    seo_title: post.seo_title || '', seo_description: post.seo_description || '',
    seo_og_image_url: post.seo_og_image_url || '',
  }
}

/** Ejecuta una petición y devuelve { value } o { error } sin lanzar. */
const attempt = async (request) => {
  try { return { value: await request() } } catch (error) { return { error } }
}

const toImage = row => ({ key: row.id, id: row.id, url_externa: row.url_externa, alt_text: row.alt_text || '', is_cover_image: Boolean(row.is_cover_image) })

const Blog = () => {
  const { selectedCompany } = useCompany()
  const { t } = useLanguage()
  const { toast } = useFeedback()
  const { canEdit } = usePermissions()
  const companyId = selectedCompany?.id
  const [posts, setPosts] = useState([])
  const [state, setState] = useState('loading')
  const [reloadKey, setReloadKey] = useState(0)
  const [statusFilter, setStatusFilter] = useState('all')
  const [query, setQuery] = useState('')
  const [editing, setEditing] = useState(null)
  const [isEditorOpen, setIsEditorOpen] = useState(false)
  const [editorKey, setEditorKey] = useState(0)
  const [form, setForm] = useState(EMPTY_FORM)
  const [images, setImages] = useState([])
  const [savedMedia, setSavedMedia] = useState([])
  const [mediaState, setMediaState] = useState('ready')
  const [formError, setFormError] = useState('')
  const [imagesError, setImagesError] = useState('')
  const [saving, setSaving] = useState(false)
  const mediaRequest = useRef(0)

  useEffect(() => {
    if (!companyId) return undefined
    let active = true
    blogService.getPosts(companyId)
      .then(data => { if (active) { setPosts(data); setState('ready') } })
      .catch(() => { if (active) setState('error') })
    return () => { active = false }
  }, [companyId, reloadKey])

  // Al cambiar de empresa se vacía todo lo de la anterior (patrón «estado previo» de React).
  const [shownCompany, setShownCompany] = useState(companyId)
  if (shownCompany !== companyId) {
    setShownCompany(companyId)
    setState('loading')
    setPosts([])
    setEditing(null)
    setIsEditorOpen(false)
    setForm(EMPTY_FORM)
    setImages([])
    setSavedMedia([])
  }

  const counts = useMemo(() => ({
    all: posts.length,
    draft: posts.filter(post => post.status === 'draft').length,
    published: posts.filter(post => post.status === 'published').length,
    archived: posts.filter(post => post.status === 'archived').length,
  }), [posts])

  const visiblePosts = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase()
    return posts.filter(post => (statusFilter === 'all' || post.status === statusFilter)
      && (!needle || [post.title, post.slug, post.intro].some(value => String(value || '').toLocaleLowerCase().includes(needle))))
  }, [posts, query, statusFilter])

  const openEditor = (post) => {
    setIsEditorOpen(true)
    setEditorKey(key => key + 1)
    setEditing(post)
    setForm(post ? toForm(post) : EMPTY_FORM)
    setImages([])
    setSavedMedia([])
    setFormError('')
    setImagesError('')
  }

  const loadMedia = async (postId) => {
    const request = ++mediaRequest.current
    setMediaState('loading')
    try {
      const rows = await blogService.getPostMedia(postId)
      if (request !== mediaRequest.current) return
      const own = rows.filter(row => row.file_type === 'image')
      setSavedMedia(own)
      setImages(own.map(toImage))
      setMediaState('ready')
    } catch {
      if (request === mediaRequest.current) setMediaState('error')
    }
  }

  const beginCreate = () => { mediaRequest.current += 1; setMediaState('ready'); openEditor(null) }
  const beginEdit = (post) => { openEditor(post); loadMedia(post.id) }
  const closeEditor = () => { mediaRequest.current += 1; setEditing(null); setIsEditorOpen(false); setFormError('') }

  const handleSeoChange = values => setForm(current => ({ ...current, ...values }))
  const updateField = key => event => setForm(current => ({ ...current, [key]: event.target.value }))

  // SEO que se aplicará al guardar: lo vacío o lo que seguía siendo automático se recalcula.
  const takenSlugs = useMemo(() => posts.filter(post => post.id !== editing?.id).map(post => post.slug).filter(Boolean), [posts, editing])
  const seoInput = {
    form, previous: editing, previousImages: savedMedia, companyName: selectedCompany?.name,
    takenSlugs, keepSlug: Boolean(editing?.published_at),
  }
  const autoSeo = applyAutoSeo({ ...seoInput, images: images.filter(image => image.url_externa) })
  // Placeholders: lo que se generaría si el campo estuviera vacío.
  const placeholders = applyAutoSeo({ ...seoInput, form: { ...form, slug: editing?.published_at ? form.slug : '', seo_title: '', seo_description: '', seo_og_image_url: '' }, previous: null, images: images.filter(image => image.url_externa) })
  const checklist = seoChecklist({ seo: autoSeo, form, images })
  const checksOk = checklist.filter(check => check.ok).length

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (!canEdit || !companyId || saving) return
    if (!form.title.trim()) { setFormError(t('blog.titleRequired')); return }
    if (!markdownToText(form.body).trim()) { setFormError(t('blog.bodyRequired')); return }
    if (form.status === 'published' && images.length === 0) {
      setImagesError(t('blog.images.requiredToPublish'))
      setFormError(t('blog.images.requiredToPublish'))
      return
    }
    if (mediaState !== 'ready') { setFormError(t('blog.images.loadError')); return }
    setSaving(true)
    setFormError('')
    setImagesError('')

    const withAlt = autoAltTexts(images, form.title)
    const seo = applyAutoSeo({ ...seoInput, images: withAlt.filter(image => image.url_externa) })
    const slug = slugify(seo.slug || form.title)
    if (!slug) { setSaving(false); setFormError(t('blog.slugRequired')); return }
    // Un artículo no aparece publicado hasta tener sus imágenes guardadas.
    const publishing = form.status === 'published' && editing?.status !== 'published'
    const payload = {
      title: form.title.trim(), slug, heading: form.heading.trim() || null,
      intro: form.intro.trim() || null, body: form.body.trim(),
      status: publishing ? (editing?.status || 'draft') : form.status,
      seo_title: seo.seo_title || null, seo_description: seo.seo_description || null,
      seo_og_image_url: seo.seo_og_image_url || null,
    }

    const first = await attempt(() => editing
      ? blogService.updatePost(editing.id, payload)
      : blogService.createPost({ ...payload, company_id: companyId }))
    if (first.error) {
      setSaving(false)
      setFormError(first.error?.code === '23505' ? t('blog.slugDuplicate') : t('blog.saveError'))
      return
    }
    const post = first.value
    // A partir de aquí el artículo existe: un reintento debe actualizarlo, no duplicarlo.
    setEditing(post)
    setPosts(current => current.some(item => item.id === post.id) ? current.map(item => item.id === post.id ? post : item) : [post, ...current])

    const sync = await attempt(() => blogService.syncImages(companyId, post.id, withAlt, savedMedia))
    if (sync.error) {
      const done = sync.error?.saved || []
      setImages(withAlt.map((image, index) => done[index] ? { ...toImage(done[index]), is_cover_image: image.is_cover_image } : image))
      const fresh = await attempt(() => blogService.getPostMedia(post.id))
      if (fresh.value) setSavedMedia(fresh.value.filter(row => row.file_type === 'image'))
      setSaving(false)
      setImagesError(t('blog.images.saveError'))
      setFormError(t('blog.images.saveError'))
      return
    }
    const media = sync.value

    const coverSeo = applyAutoSeo({ ...seoInput, form: { ...form, ...payload, seo_og_image_url: form.seo_og_image_url }, images: media })
    const finalUpdates = {}
    if (publishing) finalUpdates.status = 'published'
    if ((coverSeo.seo_og_image_url || null) !== post.seo_og_image_url) finalUpdates.seo_og_image_url = coverSeo.seo_og_image_url || null
    const last = Object.keys(finalUpdates).length ? await attempt(() => blogService.updatePost(post.id, finalUpdates)) : { value: post }
    if (last.error) {
      setSavedMedia(media)
      setImages(media.map(toImage))
      setSaving(false)
      setFormError(t('blog.publishError'))
      return
    }

    setPosts(current => current.map(item => item.id === last.value.id ? last.value : item))
    toast.success(editing ? t('blog.saved') : t('blog.created'))
    setSaving(false)
    closeEditor()
  }

  const preview = buildSeoPreview({ title: form.title, summary: form.intro, seoTitle: form.seo_title || placeholders.seo_title, seoDescription: form.seo_description || placeholders.seo_description, slug: form.slug || placeholders.slug, section: 'blog' })

  if (!selectedCompany) return <div className="page-content"><p>{t('dashboard.selectCompanyDescription')}</p></div>

  return (
    <div className="page-content page-content-wide">
      <PageHeader
        title={t('blog.title')}
        description={t('blog.description')}
        actions={canEdit && !isEditorOpen && <button type="button" className="primary-button" onClick={beginCreate}><Icon name="plus" size={16} />{t('blog.newPost')}</button>}
      />

      {isEditorOpen ? (
        <form className={styles.editor} onSubmit={handleSubmit} noValidate>
          <div className={styles.editorTop}>
            <h3>{editing ? t('blog.editPost') : t('blog.newPost')}</h3>
            <div className={styles.actions}>
              <button type="button" className="ghost-button" onClick={closeEditor} disabled={saving}>{t('common.cancel')}</button>
              {canEdit && <button type="submit" className="primary-button" disabled={saving || mediaState === 'loading'}><Icon name="save" size={16} />{saving ? t('common.savingChanges') : t('common.save')}</button>}
            </div>
          </div>
          {formError && <p className={styles.formError} role="alert">{formError}</p>}
          <FormSection title={t('blog.contentSection')} description={t('blog.contentDescription')} icon="blog" headingLevel={2}>
            <div className={styles.fields}>
              <div className="field">
                <label className="field-label" htmlFor="blog-title">{t('blog.postTitle')}</label>
                <input id="blog-title" className="input" value={form.title} onChange={updateField('title')} maxLength={200} required aria-describedby="blog-title-help" disabled={!canEdit} />
                <p id="blog-title-help" className="field-help">{t('blog.titleHelp')}</p>
              </div>
              <div className="field">
                <label className="field-label" htmlFor="blog-heading">{t('blog.heading')}</label>
                <input id="blog-heading" className="input" value={form.heading} onChange={updateField('heading')} maxLength={200} disabled={!canEdit} />
              </div>
              <div className="field">
                <label className="field-label" htmlFor="blog-intro">{t('blog.intro')}</label>
                <textarea id="blog-intro" className="input" value={form.intro} onChange={updateField('intro')} rows={3} maxLength={500} aria-describedby="blog-intro-help" disabled={!canEdit} />
                <p id="blog-intro-help" className="field-help">{t('blog.introHelp')}</p>
              </div>
              <div className="field">
                <span className="field-label" id="blog-body-label">{t('blog.body')}</span>
                <RichTextEditor
                  key={editorKey} id="blog-body" value={form.body} disabled={!canEdit}
                  onChange={body => setForm(current => ({ ...current, body }))}
                  labelledBy="blog-body-label" describedBy="blog-body-help"
                />
                <p id="blog-body-help" className="field-help">{t('blog.bodyHelp')}</p>
              </div>
              <div className="field">
                <label className="field-label" htmlFor="blog-status">{t('blog.status')}</label>
                <select id="blog-status" className="select" value={form.status} onChange={updateField('status')} disabled={!canEdit}>
                  {['draft', 'published', 'archived'].map(status => <option key={status} value={status}>{t(`blog.status_${status}`)}</option>)}
                </select>
                {editing?.published_at && <p className="field-help">{t('blog.publishedOn').replace('{date}', new Date(editing.published_at).toLocaleDateString())}</p>}
              </div>
            </div>
          </FormSection>

          <FormSection title={t('blog.images.title')} description={t('blog.images.description')} icon="image" headingLevel={2}>
            {mediaState === 'loading' && <p className="attr-status" role="status">{t('common.loading')}</p>}
            {mediaState === 'error' && <div className="error-state" role="alert"><span>{t('blog.images.loadError')}</span><button type="button" onClick={() => loadMedia(editing.id)}>{t('feedback.retry')}</button></div>}
            {mediaState === 'ready' && <BlogImages images={images} onChange={next => { setImages(next); setImagesError('') }} title={form.title.trim()} disabled={!canEdit || saving} error={imagesError} />}
          </FormSection>

          <FormSection title={t('blog.checklist.sectionTitle')} description={t('blog.checklist.sectionDescription').replace('{ok}', checksOk).replace('{total}', checklist.length)} icon="check" headingLevel={2}>
            <ul className={styles.checklist}>
              {checklist.map(check => (
                <li key={check.key} className={check.ok ? styles.checkOk : styles.checkTodo}>
                  <Icon name={check.ok ? 'check' : 'alert'} size={16} />
                  <span>{t(`blog.checklist.${check.key}`).replace('{value}', check.value).replace('{words}', BLOG_SEO.minWords)}</span>
                  <span className="sr-only">{check.ok ? t('blog.checklist.done') : t('blog.checklist.todo')}</span>
                </li>
              ))}
            </ul>
          </FormSection>

          <SeoFields values={form} onChange={handleSeoChange} title={form.title} summary={form.intro} section="blog" disabled={!canEdit} placeholders={placeholders} autoHelp={t('blog.seoAuto')} />
          <p className={styles.previewLink}>{t('seo.previewPath')}: <strong>{preview.url}</strong></p>
        </form>
      ) : (
        <>
          <div className={styles.toolbar}>
            <div className="segmented" role="group" aria-label={t('blog.filterLabel')}>
              <SlidingIndicator activeSelector="[aria-pressed='true']" />
              {FILTERS.map(filter => (
                <button key={filter} type="button" onClick={() => setStatusFilter(filter)} aria-pressed={statusFilter === filter}>
                  {t(`blog.filter_${filter}`)}<span className={styles.count}>{counts[filter]}</span>
                </button>
              ))}
            </div>
            <label className={styles.search}>
              <span className="sr-only">{t('blog.search')}</span>
              <Icon name="search" size={16} />
              <input className="input" type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder={t('blog.search')} />
            </label>
          </div>
          {state === 'loading' && <p className="attr-status" role="status">{t('common.loading')}</p>}
          {state === 'error' && <div className="error-state" role="alert"><span>{t('blog.loadError')}</span><button type="button" onClick={() => { setState('loading'); setReloadKey(key => key + 1) }}>{t('feedback.retry')}</button></div>}
          {state === 'ready' && visiblePosts.length === 0 && <div className="card"><EmptyState icon="blog" title={posts.length ? t('blog.noMatches') : t('blog.empty')} description={posts.length ? t('blog.noMatchesHint') : t('blog.emptyHint')} /></div>}
          {state === 'ready' && visiblePosts.length > 0 && (
            <ul className={styles.list}>
              {visiblePosts.map(post => (
                <li key={post.id} className={styles.post}>
                  <button type="button" className={styles.openPost} onClick={() => beginEdit(post)}>
                    {post.seo_og_image_url && <img className={styles.postCover} src={post.seo_og_image_url} alt="" loading="lazy" />}
                    <span className={styles.postText}>
                      <span className={styles.postHead}><strong>{post.title}</strong><span className={`${styles.status} ${styles[`status_${post.status}`]}`}>{t(`blog.status_${post.status}`)}</span></span>
                      <span className={styles.postSlug}>/{post.slug || post.id}</span>
                      <span className={styles.postIntro}>{post.intro || post.heading || markdownToText(post.body)}</span>
                      <span className={styles.postDate}>{post.published_at ? t('blog.publishedOn').replace('{date}', new Date(post.published_at).toLocaleDateString()) : t('blog.updatedOn').replace('{date}', new Date(post.updated_at || post.created_at).toLocaleDateString())}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  )
}

export default Blog
