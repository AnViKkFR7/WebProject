import { useId } from 'react'
import { useLanguage } from '../../contexts/LanguageContext'
import { buildSeoPreview, SEO_LIMITS } from '../../lib/contentSeo'
import FormSection from '../ui/FormSection'
import styles from './SeoFields.module.css'

export default function SeoFields({ values, onChange, title, summary, section, disabled = false }) {
  const { t } = useLanguage()
  const id = useId()
  const preview = buildSeoPreview({
    title, summary, seoTitle: values.seo_title, seoDescription: values.seo_description,
    slug: values.slug, section,
  })
  const update = (key) => (event) => onChange({ ...values, [key]: event.target.value })

  return (
    <FormSection title={t('seo.sectionTitle')} description={t('seo.sectionDescription')} icon="search" headingLevel={2}>
      <div className={styles.fields}>
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
