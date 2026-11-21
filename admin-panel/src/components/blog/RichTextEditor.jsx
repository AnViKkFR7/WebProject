import { useId, useState } from 'react'
import { EditorContent, useEditor, useEditorState } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { useLanguage } from '../../contexts/LanguageContext'
import { docToMarkdown, markdownToHtml, safeHref } from '../../lib/blogMarkdown'
import Icon from '../ui/Icon'
import styles from './RichTextEditor.module.css'

// Editor visual sencillo para el blog. Lo que se guarda es Markdown (ver
// lib/blogMarkdown.js), así que las webs que ya pintan el blog siguen igual.
// Montar con `key` distinta al cambiar de artículo: el contenido inicial solo
// se lee al crear el editor.
export default function RichTextEditor({ id, value, onChange, disabled = false, describedBy, labelledBy }) {
  const { t } = useLanguage()
  const linkFieldId = useId()
  const [linkDraft, setLinkDraft] = useState(null) // null = cerrado
  const [linkError, setLinkError] = useState(false)

  const editor = useEditor({
    extensions: [StarterKit.configure({
      heading: { levels: [2, 3] },
      code: false, codeBlock: false, strike: false, underline: false,
      link: { openOnClick: false, autolink: true, defaultProtocol: 'https', protocols: ['mailto', 'tel'], isAllowedUri: href => Boolean(safeHref(href)) },
    })],
    content: markdownToHtml(value),
    editable: !disabled,
    editorProps: {
      attributes: {
        id, class: styles.content, role: 'textbox', 'aria-multiline': 'true',
        ...(labelledBy ? { 'aria-labelledby': labelledBy } : {}),
        ...(describedBy ? { 'aria-describedby': describedBy } : {}),
      },
    },
    onUpdate: ({ editor: current }) => onChange(docToMarkdown(current.getJSON())),
  })

  const state = useEditorState({
    editor,
    selector: ({ editor: current }) => current ? {
      block: current.isActive('heading', { level: 2 }) ? 'h2' : current.isActive('heading', { level: 3 }) ? 'h3' : 'p',
      bold: current.isActive('bold'), italic: current.isActive('italic'),
      bulletList: current.isActive('bulletList'), orderedList: current.isActive('orderedList'),
      blockquote: current.isActive('blockquote'), link: current.isActive('link'),
      canUndo: current.can().undo(), canRedo: current.can().redo(),
    } : {},
  })

  if (!editor) return null
  const chain = () => editor.chain().focus()

  const setBlock = (block) => {
    if (block === 'p') chain().setParagraph().run()
    else chain().setHeading({ level: block === 'h2' ? 2 : 3 }).run()
  }

  const openLink = () => {
    setLinkError(false)
    setLinkDraft(editor.getAttributes('link').href || '')
  }
  const applyLink = (event) => {
    event.preventDefault()
    const raw = linkDraft.trim()
    if (!raw) { chain().extendMarkRange('link').unsetLink().run(); setLinkDraft(null); return }
    const href = safeHref(/^[a-z]+:/i.test(raw) ? raw : `https://${raw}`)
    if (!href) { setLinkError(true); return }
    chain().extendMarkRange('link').setLink({ href }).run()
    setLinkDraft(null)
  }

  const button = (key, label, active, onClick, content, extra = {}) => (
    <button
      key={key} type="button" className={styles.tool} onClick={onClick} disabled={disabled || extra.disabled}
      aria-label={label} title={label} {...(active === undefined ? {} : { 'aria-pressed': Boolean(active) })}
    >{content}</button>
  )

  return (
    <div className={`${styles.editor} ${disabled ? styles.disabled : ''}`}>
      <div className={styles.toolbar} role="toolbar" aria-label={t('blog.editor.toolbar')} aria-controls={id}>
        <label className={styles.blockSelect}>
          <span className="sr-only">{t('blog.editor.blockType')}</span>
          <select className="select" value={state.block} onChange={event => setBlock(event.target.value)} disabled={disabled}>
            <option value="p">{t('blog.editor.paragraph')}</option>
            <option value="h2">{t('blog.editor.heading2')}</option>
            <option value="h3">{t('blog.editor.heading3')}</option>
          </select>
        </label>
        <span className={styles.separator} aria-hidden="true" />
        {button('bold', t('blog.editor.bold'), state.bold, () => chain().toggleBold().run(), <strong>B</strong>)}
        {button('italic', t('blog.editor.italic'), state.italic, () => chain().toggleItalic().run(), <em className={styles.serif}>I</em>)}
        {button('link', t('blog.editor.link'), state.link, openLink, <Icon name="link" size={16} />)}
        <span className={styles.separator} aria-hidden="true" />
        {button('ul', t('blog.editor.bulletList'), state.bulletList, () => chain().toggleBulletList().run(), <Icon name="list" size={16} />)}
        {button('ol', t('blog.editor.orderedList'), state.orderedList, () => chain().toggleOrderedList().run(), <span className={styles.glyph}>1.</span>)}
        {button('quote', t('blog.editor.quote'), state.blockquote, () => chain().toggleBlockquote().run(), <span className={styles.glyph}>“ ”</span>)}
        {button('hr', t('blog.editor.divider'), undefined, () => chain().setHorizontalRule().run(), <span className={styles.glyph}>―</span>)}
        <span className={styles.spacer} />
        {button('undo', t('blog.editor.undo'), undefined, () => chain().undo().run(), <Icon name="reset" size={16} />, { disabled: !state.canUndo })}
        {button('redo', t('blog.editor.redo'), undefined, () => chain().redo().run(), <Icon name="reset" size={16} className={styles.mirror} />, { disabled: !state.canRedo })}
      </div>

      {linkDraft !== null && (
        <form className={styles.linkBar} onSubmit={applyLink} noValidate>
          <label htmlFor={linkFieldId} className="field-label">{t('blog.editor.linkUrl')}</label>
          <input
            id={linkFieldId} className="input" type="url" inputMode="url" value={linkDraft} autoFocus
            placeholder="https://…" onChange={event => { setLinkDraft(event.target.value); setLinkError(false) }}
            aria-invalid={linkError} aria-describedby={linkError ? `${linkFieldId}-error` : undefined}
            onKeyDown={event => { if (event.key === 'Escape') { event.preventDefault(); setLinkDraft(null); editor.commands.focus() } }}
          />
          <button type="submit" className="primary-button small">{t('blog.editor.linkApply')}</button>
          {state.link && <button type="button" className="ghost-button small" onClick={() => { chain().extendMarkRange('link').unsetLink().run(); setLinkDraft(null) }}>{t('blog.editor.linkRemove')}</button>}
          <button type="button" className="ghost-button small" onClick={() => { setLinkDraft(null); editor.commands.focus() }}>{t('common.cancel')}</button>
          {linkError && <p id={`${linkFieldId}-error`} className={styles.linkError} role="alert">{t('blog.editor.linkInvalid')}</p>}
        </form>
      )}

      <EditorContent editor={editor} />
    </div>
  )
}
