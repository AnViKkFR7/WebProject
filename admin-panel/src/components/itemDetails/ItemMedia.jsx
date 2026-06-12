import { useState, useEffect, useRef } from 'react'
import { itemMediaService } from '../../services/itemMediaService'
import { useLanguage } from '../../contexts/LanguageContext'
import '../../styles/ItemMedia.css'

/**
 * Compresses and converts an image file to WebP.
 * Resizes so neither side exceeds maxPx; then encodes at given quality (0–1).
 */
const compressToWebP = (file, maxPx = 1920, quality = 0.82) =>
  new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      let { naturalWidth: w, naturalHeight: h } = img
      if (w > maxPx || h > maxPx) {
        if (w >= h) { h = Math.round(h * (maxPx / w)); w = maxPx }
        else        { w = Math.round(w * (maxPx / h)); h = maxPx }
      }
      const canvas = document.createElement('canvas')
      canvas.width  = w
      canvas.height = h
      canvas.getContext('2d').drawImage(img, 0, 0, w, h)
      canvas.toBlob(
        (blob) => {
          if (!blob) return reject(new Error(`No se pudo comprimir: ${file.name}`))
          const name = file.name.replace(/\.[^.]+$/, '') + '.webp'
          resolve(new File([blob], name, { type: 'image/webp' }))
        },
        'image/webp',
        quality
      )
    }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error(`No se pudo leer: ${file.name}`)) }
    img.src = url
  })

const ItemMedia = ({ itemId, canEdit }) => {
  const { t } = useLanguage()
  const [media, setMedia] = useState([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState(null)
  const [currentImageIndex, setCurrentImageIndex] = useState(0)
  const [editingDescriptionId, setEditingDescriptionId] = useState(null)
  const [tempDescription, setTempDescription] = useState('')
  const [pdfPreview, setPdfPreview] = useState(null)
  const [imageLoaded, setImageLoaded] = useState({})
  const [collapsed, setCollapsed] = useState(false)
  const [imageDimensions, setImageDimensions] = useState({})
  const imageRefs = useRef({})
  const dragItem = useRef(null)
  const reorderGridRef = useRef(null)
  const [showReorderModal, setShowReorderModal] = useState(false)
  const [reorderImages, setReorderImages] = useState([])

  const images = media.filter(m => m.file_type === 'image')
  const pdfs = media.filter(m => m.file_type === 'pdf')

  useEffect(() => {
    loadMedia()
  }, [itemId])

  // Preload adjacent images for smooth navigation
  useEffect(() => {
    if (images.length === 0) return

    const preloadImage = (index) => {
      if (index >= 0 && index < images.length && !imageLoaded[index]) {
        const img = new Image()
        img.src = images[index].url_externa
        img.onload = () => {
          setImageLoaded(prev => ({ ...prev, [index]: true }))
          setImageDimensions(prev => ({
            ...prev,
            [index]: { width: img.naturalWidth, height: img.naturalHeight }
          }))
        }
      }
    }

    // Preload current, next and previous
    preloadImage(currentImageIndex)
    preloadImage(currentImageIndex + 1)
    preloadImage(currentImageIndex - 1)
  }, [currentImageIndex, images])

  const loadMedia = async () => {
    try {
      setLoading(true)
      const data = await itemMediaService.getItemMedia(itemId)
      setMedia(data)
      setError(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleFileUpload = async (e, fileType) => {
    const files = Array.from(e.target.files)
    if (files.length === 0) return

    const maxCount = fileType === 'image' ? 35 : 2
    const currentCount = fileType === 'image' ? images.length : pdfs.length
    const availableSlots = maxCount - currentCount

    if (files.length > availableSlots) {
      alert(t(`itemMedia.max${fileType === 'image' ? 'Images' : 'Pdfs'}Warning`).replace('{max}', maxCount))
      return
    }

    setUploading(true)
    setError(null)

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i]
        
        // Validate file size (50MB)
        if (file.size > 50 * 1024 * 1024) {
          throw new Error(t('itemMedia.fileSizeError').replace('{name}', file.name))
        }

        // For PDFs, require description
        let altText = ''
        if (fileType === 'pdf') {
          altText = prompt(t('itemMedia.pdfDescriptionPrompt'))
          if (!altText || altText.trim() === '') {
            alert(t('itemMedia.pdfDescriptionRequired'))
            continue
          }
        }

        const nextSortOrder = media.filter(m => m.file_type === fileType).length + i
        const isCover = fileType === 'image' && images.length === 0 && i === 0

        await itemMediaService.uploadMedia(
          file,
          itemId,
          fileType,
          altText,
          isCover,
          nextSortOrder
        )
      }

      await loadMedia()
      e.target.value = null
    } catch (err) {
      setError(err.message)
    } finally {
      setUploading(false)
    }
  }

  const handleOptimizedUpload = async (e) => {
    const files = Array.from(e.target.files)
    if (files.length === 0) return

    const availableSlots = 35 - images.length
    if (files.length > availableSlots) {
      alert(t('itemMedia.maxImagesWarning').replace('{max}', 35))
      return
    }

    setUploading(true)
    setError(null)

    try {
      for (let i = 0; i < files.length; i++) {
        const raw = files[i]
        const optimized = await compressToWebP(raw)
        const nextSortOrder = images.length + i
        const isCover = images.length === 0 && i === 0
        await itemMediaService.uploadMedia(
          optimized,
          itemId,
          'image',
          '',
          isCover,
          nextSortOrder
        )
      }
      await loadMedia()
      e.target.value = null
    } catch (err) {
      setError(err.message)
    } finally {
      setUploading(false)
    }
  }

  const handleDelete = async (mediaId, fileType) => {
    if (!confirm(t('itemMedia.deleteConfirm'))) return

    try {
      setError(null)
      await itemMediaService.deleteMedia(mediaId)
      await loadMedia()
      
      if (fileType === 'image' && currentImageIndex >= images.length - 1) {
        setCurrentImageIndex(Math.max(0, images.length - 2))
      }
    } catch (err) {
      setError(err.message)
    }
  }

  const handleSetCover = async (mediaId) => {
    try {
      setError(null)
      await itemMediaService.setCoverImage(itemId, mediaId)
      await loadMedia()
    } catch (err) {
      setError(err.message)
    }
  }

  // Non-passive touchmove on reorder grid to prevent background scroll while dragging
  useEffect(() => {
    if (!showReorderModal) return
    const el = reorderGridRef.current
    if (!el) return
    const prevent = (e) => { if (dragItem.current !== null) e.preventDefault() }
    el.addEventListener('touchmove', prevent, { passive: false })
    return () => el.removeEventListener('touchmove', prevent)
  }, [showReorderModal])

  const handleTouchStart = (index) => {
    dragItem.current = index
  }

  const handleTouchMove = (e) => {
    if (dragItem.current === null) return
    const touch = e.touches[0]
    const el = document.elementFromPoint(touch.clientX, touch.clientY)
    if (!el) return
    const thumb = el.closest('[data-reorder-index]')
    if (!thumb) return
    const targetIndex = parseInt(thumb.dataset.reorderIndex, 10)
    if (!isNaN(targetIndex) && targetIndex !== dragItem.current) {
      handleDragEnter(targetIndex)
    }
  }

  const handleTouchEnd = () => {
    dragItem.current = null
  }

  const openReorderModal = () => {
    setReorderImages([...images])
    setShowReorderModal(true)
  }

  const closeReorderModal = () => {
    setShowReorderModal(false)
  }

  const handleDragStart = (index) => {
    dragItem.current = index
  }

  const handleDragEnter = (index) => {
    if (dragItem.current === null || dragItem.current === index) return
    const copy = [...reorderImages]
    const [dragged] = copy.splice(dragItem.current, 1)
    copy.splice(index, 0, dragged)
    dragItem.current = index
    setReorderImages(copy)
  }

  const saveReorder = async () => {
    try {
      setError(null)
      await itemMediaService.reorderMedia(reorderImages)
      await loadMedia()
      setShowReorderModal(false)
    } catch (err) {
      setError(err.message)
      setShowReorderModal(false)
    }
  }

  const startEditDescription = (id, currentDesc) => {
    setEditingDescriptionId(id)
    setTempDescription(currentDesc || '')
  }

  const saveDescription = async (mediaId) => {
    try {
      setError(null)
      await itemMediaService.updateMedia(mediaId, { alt_text: tempDescription })
      await loadMedia()
      setEditingDescriptionId(null)
    } catch (err) {
      setError(err.message)
    }
  }

  const cancelEditDescription = () => {
    setEditingDescriptionId(null)
    setTempDescription('')
  }

  const handleViewPdf = (pdf) => {
    setPdfPreview(pdf)
  }

  const closePdfPreview = () => {
    setPdfPreview(null)
  }

  if (loading) {
    return (
      <div className="section-card">
        <h2 className="section-title">{t('itemMedia.title')}</h2>
        <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
          {t('common.loading')}...
        </div>
      </div>
    )
  }

  return (
    <div className="section-card">
      <div className="section-header-with-toggle">
        <h2 className="section-title">{t('itemMedia.title')}</h2>
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="collapse-toggle-btn"
          title={collapsed ? t('common.expand') : t('common.collapse')}
        >
          {collapsed ? '▼' : '▲'}
        </button>
      </div>

      {!collapsed && (
        <>
          {error && (
            <div className="alert error" style={{ marginBottom: '1rem' }}>
              {error}
            </div>
          )}

          {/* IMAGES SECTION */}
          <div className="media-section">
        <div className="media-section-header">
          <h3>{t('itemMedia.images')} ({images.length}/35)</h3>
          {canEdit && (
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
              {images.length < 35 && (
                <>
                  {/* <label className="upload-button">
                    <input
                      type="file"
                      multiple
                      accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
                      onChange={(e) => handleFileUpload(e, 'image')}
                      disabled={uploading}
                      style={{ display: 'none' }}
                    />
                    {uploading ? t('itemMedia.uploading') : t('itemMedia.addImages')}
                  </label> */}
                  <label className="upload-button upload-button--optimized">
                    <input
                      type="file"
                      multiple
                      accept="image/*"
                      onChange={handleOptimizedUpload}
                      disabled={uploading}
                      style={{ display: 'none' }}
                    />
                    {uploading ? t('itemMedia.uploading') : '✨ Subir imágenes optimizadas'}
                  </label>
                </>
              )}
              {images.length > 1 && (
                <button
                  className="upload-button upload-button--reorder"
                  onClick={openReorderModal}
                  disabled={uploading}
                >
                  ⠿ {t('itemMedia.reorderImages')}
                </button>
              )}
            </div>
          )}
        </div>

        {images.length === 0 ? (
          <div className="no-media">
            {t('itemMedia.noImages')}
          </div>
        ) : (
          <div className="carousel-container">
            <div className="carousel-main">
              {!imageLoaded[currentImageIndex] && (
                <div className="image-loading">
                  <div className="spinner"></div>
                </div>
              )}
              <img
                ref={el => imageRefs.current[currentImageIndex] = el}
                src={images[currentImageIndex]?.url_externa}
                alt={images[currentImageIndex]?.alt_text || 'Image'}
                className={`carousel-image ${imageLoaded[currentImageIndex] ? 'loaded' : ''}`}
                onLoad={() => setImageLoaded(prev => ({ ...prev, [currentImageIndex]: true }))}
              />

              {canEdit && (
                <div className="carousel-controls">
                  <button
                    onClick={() => setCurrentImageIndex(Math.max(0, currentImageIndex - 1))}
                    disabled={currentImageIndex === 0}
                    className="carousel-nav-btn"
                  >
                    ‹
                  </button>
                  <button
                    onClick={() => setCurrentImageIndex(Math.min(images.length - 1, currentImageIndex + 1))}
                    disabled={currentImageIndex === images.length - 1}
                    className="carousel-nav-btn"
                  >
                    ›
                  </button>
                </div>
              )}
            </div>

            <div className="carousel-info">
              <div className="carousel-header">
                <span className="carousel-counter">
                  {currentImageIndex + 1} / {images.length}
                </span>
                {images[currentImageIndex]?.is_cover && (
                  <span className="cover-badge-inline">
                    <span className="cover-icon">⭐</span>
                    <span className="cover-text">{t('itemMedia.coverImage')}</span>
                  </span>
                )}
              </div>

              {editingDescriptionId === images[currentImageIndex]?.id ? (
                <div className="description-edit">
                  <input
                    type="text"
                    value={tempDescription}
                    onChange={(e) => setTempDescription(e.target.value)}
                    placeholder={t('itemMedia.descriptionPlaceholder')}
                    className="input"
                    autoFocus
                  />
                  <button onClick={() => saveDescription(images[currentImageIndex].id)} className="save-btn">
                    ✓
                  </button>
                  <button onClick={cancelEditDescription} className="cancel-btn">
                    ✕
                  </button>
                </div>
              ) : (
                <div className="description-display">
                  <p>{images[currentImageIndex]?.alt_text || t('itemMedia.noDescription')}</p>
                  {canEdit && (
                    <button
                      onClick={() => startEditDescription(images[currentImageIndex].id, images[currentImageIndex].alt_text)}
                      className="edit-btn"
                    >
                      ✏️
                    </button>
                  )}
                </div>
              )}

              {imageDimensions[currentImageIndex] && (
                <div className="image-dimensions">
                  <span className="dimensions-label">📐 {t('itemMedia.dimensions')}:</span>
                  <span className="dimensions-value">
                    {imageDimensions[currentImageIndex].width} × {imageDimensions[currentImageIndex].height} px
                  </span>
                </div>
              )}

              {canEdit && (
                <div className="image-actions">
                  <button
                    onClick={() => handleSetCover(images[currentImageIndex].id)}
                    className="action-btn primary"
                    disabled={images[currentImageIndex]?.is_cover}
                  >
                    {t('itemMedia.setCover')}
                  </button>
                  <button
                    onClick={() => handleDelete(images[currentImageIndex].id, 'image')}
                    className="action-btn danger"
                  >
                    {t('itemMedia.delete')}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* PDFs SECTION */}
      <div className="media-section">
        <div className="media-section-header">
          <h3>{t('itemMedia.pdfs')} ({pdfs.length}/2)</h3>
          {canEdit && pdfs.length < 2 && (
            <label className="upload-button">
              <input
                type="file"
                multiple
                accept=".pdf,application/pdf"
                onChange={(e) => handleFileUpload(e, 'pdf')}
                disabled={uploading}
                style={{ display: 'none' }}
              />
              {uploading ? t('itemMedia.uploading') : t('itemMedia.addPdfs')}
            </label>
          )}
        </div>

        {pdfs.length === 0 ? (
          <div className="no-media">
            {t('itemMedia.noPdfs')}
          </div>
        ) : (
          <div className="pdf-list">
            {pdfs.map((pdf) => (
              <div key={pdf.id} className="pdf-item">
                <div className="pdf-icon">📄</div>
                <div className="pdf-info">
                  {editingDescriptionId === pdf.id ? (
                    <div className="description-edit">
                      <input
                        type="text"
                        value={tempDescription}
                        onChange={(e) => setTempDescription(e.target.value)}
                        placeholder={t('itemMedia.descriptionPlaceholder')}
                        className="input"
                        autoFocus
                      />
                      <button onClick={() => saveDescription(pdf.id)} className="save-btn">✓</button>
                      <button onClick={cancelEditDescription} className="cancel-btn">✕</button>
                    </div>
                  ) : (
                    <div className="description-display">
                      <p>{pdf.alt_text}</p>
                      {canEdit && (
                        <button
                          onClick={() => startEditDescription(pdf.id, pdf.alt_text)}
                          className="edit-btn"
                        >
                          ✏️
                        </button>
                      )}
                    </div>
                  )}
                </div>
                <div className="pdf-actions">
                  <button
                    onClick={() => handleViewPdf(pdf)}
                    className="action-btn"
                  >
                    {t('itemMedia.view')}
                  </button>
                  {canEdit && (
                    <button
                      onClick={() => handleDelete(pdf.id, 'pdf')}
                      className="action-btn danger"
                    >
                      {t('itemMedia.delete')}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
        </>
      )}

      {/* Reorder Modal */}
      {showReorderModal && (
        <div className="reorder-modal" onClick={closeReorderModal}>
          <div className="reorder-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="reorder-modal-header">
              <h3>{t('itemMedia.reorderTitle')}</h3>
              <button onClick={closeReorderModal} className="modal-close-btn">✕</button>
            </div>
            <p className="reorder-hint">{t('itemMedia.reorderHint')}</p>
            <div className="reorder-grid" ref={reorderGridRef}>
              {reorderImages.map((img, index) => (
                <div
                  key={img.id}
                  className="reorder-thumb"
                  data-reorder-index={index}
                  draggable
                  onDragStart={() => handleDragStart(index)}
                  onDragEnter={() => handleDragEnter(index)}
                  onDragEnd={() => { dragItem.current = null }}
                  onDragOver={(e) => e.preventDefault()}
                  onTouchStart={() => handleTouchStart(index)}
                  onTouchMove={handleTouchMove}
                  onTouchEnd={handleTouchEnd}
                >
                  <img src={img.url_externa} alt={img.alt_text || ''} loading="lazy" />
                  <span className="reorder-thumb-num">{index + 1}</span>
                  {img.is_cover && <span className="reorder-thumb-cover">⭐</span>}
                </div>
              ))}
            </div>
            <div className="reorder-modal-footer">
              <button onClick={closeReorderModal} className="action-btn">
                {t('common.cancel')}
              </button>
              <button onClick={saveReorder} className="action-btn primary">
                {t('itemMedia.saveOrder')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PDF Preview Modal */}
      {pdfPreview && (
        <div className="pdf-preview-modal" onClick={closePdfPreview}>
          <div className="pdf-preview-content" onClick={(e) => e.stopPropagation()}>
            <div className="pdf-preview-header">
              <h3>{pdfPreview.alt_text}</h3>
              <button onClick={closePdfPreview} className="modal-close-btn">✕</button>
            </div>
            <div className="pdf-preview-body">
              <iframe
                src={`${pdfPreview.url_externa}#toolbar=0&navpanes=0&scrollbar=0`}
                title={pdfPreview.alt_text}
                className="pdf-iframe"
                type="application/pdf"
              />
            </div>
            <div className="pdf-preview-footer">
              <a
                href={pdfPreview.url_externa}
                target="_blank"
                rel="noopener noreferrer"
                className="action-btn primary"
              >
                {t('itemMedia.openInNewTab')}
              </a>
              <button onClick={closePdfPreview} className="action-btn">
                {t('common.close')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default ItemMedia
