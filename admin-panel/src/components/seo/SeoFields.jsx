import { useEffect, useId, useState } from 'react'
import { useLanguage } from '../../contexts/LanguageContext'
import { buildSeoPreview, SEO_LIMITS, suggestItemSeo } from '../../lib/contentSeo'
import FormSection from '../ui/FormSection'
import Icon from '../ui/Icon'
import styles from './SeoFields.module.css'

export default function SeoFields({ values, onChange, title, summary, section, disabled = false, collapsed = false, onToggleCollapse }) {
  const { t } = useLanguage()
  const id = useId()
  const [suggestion, setSuggestion] = useState(null)
  useEffect(() => setSuggestion(null), [title, summary])
  const preview = buildSeoPreview({
    title, summary, seoTitle: values.seo_title, seoDescription: values.seo_description,
    slug: values.slug, section,
  })
  const update = (key) => (event) => onChange({ ...values, [key]: event.target.value })
  const propose = () => setSuggestion(suggestItemSeo({ title, summary, values }))
  const applySuggestion = () => {
    if (!suggestion) return
    onChange({ ...values, ...suggestion })
    setSuggestion(null)
  }

  return (
    <FormSection title={t('seo.sectionTitle')} description={t('seo.sectionDescription')} icon="search" headingLevel={2} className={disabled ? styles.readOnly : ''} collapsible collapsed={collapsed} onToggleCollapse={onToggleCollapse} collapseLabel={t('seo.collapse')} expandLabel={t('seo.expand')}>
      <div className={styles.fields}>
        {section === 'items' && <div className={styles.generator}>
          <div className={styles.generatorIntro}><strong>{t('seo.generatorTitle')}</strong><p>{t('seo.generatorHelp')}</p></div>
          <button type="button" className="ghost-button" onClick={propose} disabled={disabled || (!String(title || '').trim() && !String(summary || '').trim())}><Icon name="star" size={16}/>{t('seo.generate')}</button>
          {suggestion && <div className={styles.suggestion} role="status" aria-live="polite">
            {Object.keys(suggestion).length === 0
              ? <p>{t('seo.nothingToGenerate')}</p>
              : <>
                <strong>{t('seo.suggestionTitle')}</strong>
                {suggestion.slug && <p><span>{t('seo.slug')}</span><code>{suggestion.slug}</code></p>}
                {suggestion.seo_title && <p><span>{t('seo.title')}</span><span>{suggestion.seo_title}</span></p>}
                {suggestion.seo_description && <p><span>{t('seo.description')}</span><span>{suggestion.seo_description}</span></p>}
                <div><button type="button" className="primary-button small" onClick={applySuggestion}>{t('seo.applySuggestion')}</button><button type="button" className="ghost-button small" onClick={() => setSuggestion(null)}>{t('common.cancel')}</button></div>
              </>}
          </div>}
        </div>}
        <div className="field">
          <label className="field-label" htmlFor={`${id}-slug`}>{t('seo.slug')}</label>
          <input id={`${id}-slug`} className="input" value={values.slug || ''} onChange={update('slug')} maxLength={SEO_LIMITS.slug} disabled={disabled} autoCapitalize="none" spellCheck="false" />
          <p className="field-help">{t('seo.slugHelp')}</p>
        </div>
        <div className="field">
          <label className="field-label" htmlFor={`${id}-title`}>{t('seo.title')}</label>
          <input id={`${id}-title`} className="input" value={values.seo_title || ''} onChange={update('seo_title')} maxLength={SEO_LIMITS.title} disabled={disabled} aria-describedby={`${id}-title-count`} />
          <p id={`${id}-title-count`} className="field-help">{(values.seo_title || '').length}/{SEO_LIMITS.title} · {t('seo.titleHelp')}</p>
        </div>
        <div className="field">
          <label className="field-label" htmlFor={`${id}-description`}>{t('seo.description')}</label>
          <textarea id={`${id}-description`} className="input" value={values.seo_description || ''} onChange={update('seo_description')} maxLength={SEO_LIMITS.description} rows={3} disabled={disabled} aria-describedby={`${id}-description-count`} />
          <p id={`${id}-description-count`} className="field-help">{(values.seo_description || '').length}/{SEO_LIMITS.description} · {t('seo.descriptionHelp')}</p>
        </div>
        <div className="field">
          <label className="field-label" htmlFor={`${id}-image`}>{t('seo.ogImage')}</label>
          <input id={`${id}-image`} className="input" type="url" inputMode="url" placeholder="https://…" value={values.seo_og_image_url || ''} onChange={update('seo_og_image_url')} maxLength={2048} disabled={disabled} />
          <p className="field-help">{t('seo.ogImageHelp')}</p>
        </div>
        <figure className={styles.preview} aria-label={t('seo.preview')}>
          <figcaption>{t('seo.preview')}</figcaption>
          <p className={styles.url}>{preview.url}</p>
          <p className={styles.previewTitle}>{preview.title || t('seo.titleFallback')}</p>
          <p className={styles.previewDescription}>{preview.description || t('seo.descriptionFallback')}</p>
        </figure>
      </div>
    </FormSection>
  )
}
