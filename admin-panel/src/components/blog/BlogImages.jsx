import { useEffect, useId, useRef, useState } from 'react'
import { useLanguage } from '../../contexts/LanguageContext'
import { compressToWebP } from '../../lib/imageCompression'
import { BLOG_MAX_IMAGES } from '../../services/blogService'
import Icon from '../ui/Icon'
import styles from './BlogImages.module.css'

/**
 * Imágenes del artículo. No sube nada por sí mismo: las nuevas se comprimen
 * en el navegador (WebP, máx. 1920 px) y quedan pendientes hasta guardar.
 * Cada entrada: { key, id?, url_externa?, file?, preview?, alt_text, is_cover_image }.
 */
export default function BlogImages({ images, onChange, title, disabled = false, error }) {
  const { t } = useLanguage()
  const inputId = useId()
  const inputRef = useRef(null)
  const [preparing, setPreparing] = useState(false)
  const [problem, setProblem] = useState('')
  const previews = useRef(new Set())

  // Libera las vistas previas locales al desmontar.
  useEffect(() => {
    const created = previews.current
    return () => created.forEach(url => URL.revokeObjectURL(url))
  }, [])

  const update = (key, changes) => onChange(images.map(image => image.key === key ? { ...image, ...changes } : image))

  const add = async (event) => {
    const files = Array.from(event.target.files || [])
    event.target.value = ''
    if (!files.length) return
    const room = BLOG_MAX_IMAGES - images.length
    setProblem(files.length > room ? t('blog.images.max').replace('{max}', BLOG_MAX_IMAGES) : '')
    setPreparing(true)
    const added = []
    for (const file of files.slice(0, room)) {
      try {
        const optimized = await compressToWebP(file)
        const preview = URL.createObjectURL(optimized)
        previews.current.add(preview)
        added.push({ key: preview, file: optimized, preview, alt_text: '', is_cover_image: false })
      } catch {
        setProblem(t('blog.images.prepareError').replace('{name}', file.name))
      }
    }
    setPreparing(false)
    const next = [...images, ...added]
    if (next.length && !next.some(image => image.is_cover_image)) next[0] = { ...next[0], is_cover_image: true }
    onChange(next)
  }

  const remove = (key) => {
    const next = images.filter(image => image.key !== key)
    if (next.length && !next.some(image => image.is_cover_image)) next[0] = { ...next[0], is_cover_image: true }
    onChange(next)
  }

  const move = (index, delta) => {
    const next = [...images]
    const [item] = next.splice(index, 1)
    next.splice(index + delta, 0, item)
    onChange(next)
  }

  const makeCover = key => onChange(images.map(image => ({ ...image, is_cover_image: image.key === key })))

  return (
    <div className={styles.wrapper}>
      <div className={styles.head}>
        <p className={styles.count} aria-live="polite">{t('blog.images.count').replace('{count}', images.length).replace('{max}', BLOG_MAX_IMAGES)}</p>
        {!disabled && images.length < BLOG_MAX_IMAGES && (
          <>
            <input ref={inputRef} id={inputId} type="file" accept="image/jpeg,image/png,image/webp" multiple className="sr-only" onChange={add} disabled={preparing} />
            <label htmlFor={inputId} className={`ghost-button ${styles.addButton}`} aria-disabled={preparing}>
              <Icon name="upload" size={16} />{preparing ? t('blog.images.preparing') : t('blog.images.add')}
            </label>
          </>
        )}
      </div>

      {(problem || error) && <p className={styles.problem} role="alert">{error || problem}</p>}

      {images.length === 0 ? (
        <button type="button" className={styles.empty} onClick={() => inputRef.current?.click()} disabled={disabled || preparing}>
          <Icon name="image" size={28} />
          <span>{t('blog.images.emptyTitle')}</span>
          <small>{t('blog.images.emptyHint')}</small>
        </button>
      ) : (
        <ol className={styles.grid}>
          {images.map((image, index) => {
            const altId = `${inputId}-alt-${index}`
            return (
              <li key={image.key} className={`${styles.card} ${image.is_cover_image ? styles.isCover : ''}`}>
                <div className={styles.thumb}>
                  <img src={image.preview || image.url_externa} alt="" />
                  {image.is_cover_image && <span className={styles.badge}><Icon name="star" size={12} />{t('blog.images.cover')}</span>}
                  {image.file && <span className={styles.pending}>{t('blog.images.pending')}</span>}
                </div>
                <div className={styles.body}>
                  <label htmlFor={altId} className="field-label">{t('blog.images.alt')}</label>
                  <input
                    id={altId} className="input" value={image.alt_text || ''} maxLength={250} disabled={disabled}
                    placeholder={title ? (image.is_cover_image ? title : `${title} (${t('blog.images.imageN').replace('{n}', index + 1)})`) : ''}
                    onChange={event => update(image.key, { alt_text: event.target.value })}
                  />
                  {!disabled && (
                    <div className={styles.actions}>
                      {!image.is_cover_image && <button type="button" className="ghost-button small" onClick={() => makeCover(image.key)}>{t('blog.images.makeCover')}</button>}
                      <span className={styles.spacer} />
                      <button type="button" className="icon-button" onClick={() => move(index, -1)} disabled={index === 0} aria-label={t('blog.images.moveLeft').replace('{n}', index + 1)}><Icon name="chevronLeft" size={16} /></button>
                      <button type="button" className="icon-button" onClick={() => move(index, 1)} disabled={index === images.length - 1} aria-label={t('blog.images.moveRight').replace('{n}', index + 1)}><Icon name="chevronRight" size={16} /></button>
                      <button type="button" className="icon-button danger" onClick={() => remove(image.key)} aria-label={t('blog.images.remove').replace('{n}', index + 1)}><Icon name="trash" size={16} /></button>
                    </div>
                  )}
                </div>
              </li>
            )
          })}
        </ol>
      )}
      <p className="field-help">{t('blog.images.help')}</p>
    </div>
  )
}
