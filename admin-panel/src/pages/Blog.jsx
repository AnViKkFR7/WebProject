import { useCallback, useEffect, useMemo, useState } from 'react'
import { useCompany } from '../contexts/CompanyContext'
import { useFeedback } from '../contexts/FeedbackContext'
import { useLanguage } from '../contexts/LanguageContext'
import { usePermissions } from '../hooks/usePermissions'
import { buildSeoPreview, slugify } from '../lib/contentSeo'
import { blogService } from '../services/blogService'
import SeoFields from '../components/seo/SeoFields'
import FormSection from '../components/ui/FormSection'
import PageHeader from '../components/ui/PageHeader'
import EmptyState from '../components/ui/EmptyState'
import Icon from '../components/ui/Icon'
import styles from './Blog.module.css'

const FILTERS = ['all', 'draft', 'published', 'archived']
const EMPTY_FORM = {
  title: '', slug: '', heading: '', intro: '', body: '', status: 'draft',
  seo_title: '', seo_description: '', seo_og_image_url: '',
}

function toForm(post) {
  return {
    ...EMPTY_FORM,
    ...post,
    title: post.title || '', slug: post.slug || '', heading: post.heading || '',
    intro: post.intro || '', body: post.body || '', status: post.status || 'draft',
    seo_title: post.seo_title || '', seo_description: post.seo_description || '',
    seo_og_image_url: post.seo_og_image_url || '',
  }
}

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
  const [form, setForm] = useState(EMPTY_FORM)
  const [slugTouched, setSlugTouched] = useState(false)
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)

  const load = useCallback(async (signal) => {
    if (!companyId) return
    setState('loading')
    try {
      const data = await blogService.getPosts(companyId)
      if (!signal.aborted) { setPosts(data); setState('ready') }
    } catch {
      if (!signal.aborted) setState('error')
    }
  }, [companyId])

  useEffect(() => {
    const controller = new AbortController()
    load(controller.signal)
    return () => controller.abort()
  }, [load, reloadKey])

  useEffect(() => {
    setPosts([])
    setEditing(null)
    setIsEditorOpen(false)
    setForm(EMPTY_FORM)
  }, [companyId])

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

  const beginCreate = () => {
    setIsEditorOpen(true)
    setEditing(null)
    setForm(EMPTY_FORM)
    setSlugTouched(false)
    setFormError('')
  }

  const beginEdit = (post) => {
    setIsEditorOpen(true)
    setEditing(post)
    setForm(toForm(post))
    setSlugTouched(true)
    setFormError('')
  }

  const closeEditor = () => { setEditing(null); setIsEditorOpen(false); setFormError('') }

  const handleTitle = (value) => setForm(previous => ({
    ...previous,
    title: value,
    slug: slugTouched ? previous.slug : slugify(value),
  }))

  const handleSeoChange = (values) => {
    if (values.slug !== form.slug) setSlugTouched(true)
    setForm(current => ({ ...current, ...values }))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (!canEdit || !companyId) return
    const slug = slugify(form.slug || form.title)
    if (!form.title.trim()) { setFormError(t('blog.titleRequired')); return }
    if (!slug) { setFormError(t('blog.slugRequired')); return }
    setSaving(true)
    setFormError('')
    const payload = {
      title: form.title.trim(), slug, heading: form.heading.trim() || null,
      intro: form.intro.trim() || null, body: form.body.trim(), status: form.status,
      seo_title: form.seo_title.trim() || null, seo_description: form.seo_description.trim() || null,
      seo_og_image_url: form.seo_og_image_url.trim() || null,
    }
    try {
      if (editing) {
        const saved = await blogService.updatePost(editing.id, payload)
        setPosts(current => current.map(post => post.id === saved.id ? saved : post))
        toast.success(t('blog.saved'))
      } else {
        const saved = await blogService.createPost({ ...payload, company_id: companyId })
        setPosts(current => [saved, ...current])
        toast.success(t('blog.created'))
      }
      closeEditor()
    } catch (error) {
      setFormError(error?.code === '23505' ? t('blog.slugDuplicate') : t('blog.saveError'))
    } finally {
      setSaving(false)
    }
  }

  const setStatus = (status) => setForm(current => ({ ...current, status }))
  const preview = buildSeoPreview({ title: form.title, summary: form.intro, seoTitle: form.seo_title, seoDescription: form.seo_description, slug: form.slug, section: 'blog' })

  if (!selectedCompany) return <div className="page-content"><p>{t('dashboard.selectCompanyDescription')}</p></div>

  return (
    <div className="page-content page-content-wide">
      <PageHeader
        title={t('blog.title')}
        description={t('blog.description')}
        actions={canEdit && !isEditorOpen && <button type="button" className="primary-button" onClick={beginCreate}><Icon name="plus" size={16} />{t('blog.newPost')}</button>}
      />

      {isEditorOpen ? (
        <form className={styles.editor} onSubmit={handleSubmit}>
          <div className={styles.editorTop}>
            <h3>{editing ? t('blog.editPost') : t('blog.newPost')}</h3>
            <div className={styles.actions}>
              <button type="button" className="ghost-button" onClick={closeEditor} disabled={saving}>{t('common.cancel')}</button>
              {canEdit && <button type="submit" className="primary-button" disabled={saving}><Icon name="save" size={16} />{saving ? t('common.savingChanges') : t('common.save')}</button>}
            </div>
          </div>
          {formError && <p className={styles.formError} role="alert">{formError}</p>}
          <FormSection title={t('blog.contentSection')} description={t('blog.contentDescription')} icon="blog" headingLevel={2}>
            <div className={styles.fields}>
              <div className="field">
                <label className="field-label" htmlFor="blog-title">{t('blog.postTitle')}</label>
                <input id="blog-title" className="input" value={form.title} onChange={event => handleTitle(event.target.value)} maxLength={200} required disabled={!canEdit} />
              </div>
              <div className="field">
                <label className="field-label" htmlFor="blog-heading">{t('blog.heading')}</label>
                <input id="blog-heading" className="input" value={form.heading} onChange={event => setForm(current => ({ ...current, heading: event.target.value }))} maxLength={200} disabled={!canEdit} />
              </div>
              <div className="field">
                <label className="field-label" htmlFor="blog-intro">{t('blog.intro')}</label>
                <textarea id="blog-intro" className="input" value={form.intro} onChange={event => setForm(current => ({ ...current, intro: event.target.value }))} rows={3} maxLength={500} disabled={!canEdit} />
              </div>
              <div className="field">
                <label className="field-label" htmlFor="blog-body">{t('blog.body')}</label>
                <textarea id="blog-body" className={`${styles.body} input`} value={form.body} onChange={event => setForm(current => ({ ...current, body: event.target.value }))} rows={14} maxLength={100000} required aria-describedby="blog-body-help" disabled={!canEdit} />
                <p id="blog-body-help" className="field-help">{t('blog.bodyHelp')}</p>
              </div>
              <div className="field">
                <label className="field-label" htmlFor="blog-status">{t('blog.status')}</label>
                <select id="blog-status" className="select" value={form.status} onChange={event => setStatus(event.target.value)} disabled={!canEdit}>
                  {['draft', 'published', 'archived'].map(status => <option key={status} value={status}>{t(`blog.status_${status}`)}</option>)}
                </select>
                {editing?.published_at && <p className="field-help">{t('blog.publishedOn').replace('{date}', new Date(editing.published_at).toLocaleDateString())}</p>}
              </div>
            </div>
          </FormSection>
          <SeoFields values={form} onChange={handleSeoChange} title={form.title} summary={form.intro} section="blog" disabled={!canEdit} />
          <p className={styles.previewLink}>{t('seo.previewPath')}: <strong>{preview.url}</strong></p>
        </form>
      ) : (
        <>
          <div className={styles.toolbar}>
            <div className="segmented" role="group" aria-label={t('blog.filterLabel')}>
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
          {state === 'error' && <div className="error-state" role="alert"><span>{t('blog.loadError')}</span><button type="button" onClick={() => setReloadKey(key => key + 1)}>{t('feedback.retry')}</button></div>}
          {state === 'ready' && visiblePosts.length === 0 && <div className="card"><EmptyState icon="blog" title={posts.length ? t('blog.noMatches') : t('blog.empty')} description={posts.length ? t('blog.noMatchesHint') : t('blog.emptyHint')} /></div>}
          {state === 'ready' && visiblePosts.length > 0 && (
            <ul className={styles.list}>
              {visiblePosts.map(post => (
                <li key={post.id} className={styles.post}>
                  <button type="button" className={styles.openPost} onClick={() => beginEdit(post)}>
                    <span className={styles.postHead}><strong>{post.title}</strong><span className={`${styles.status} ${styles[`status_${post.status}`]}`}>{t(`blog.status_${post.status}`)}</span></span>
                    <span className={styles.postSlug}>/{post.slug || post.id}</span>
                    <span className={styles.postIntro}>{post.intro || post.heading || post.body}</span>
                    <span className={styles.postDate}>{post.published_at ? t('blog.publishedOn').replace('{date}', new Date(post.published_at).toLocaleDateString()) : t('blog.updatedOn').replace('{date}', new Date(post.updated_at || post.created_at).toLocaleDateString())}</span>
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
