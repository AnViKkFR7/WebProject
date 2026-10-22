import { useLanguage } from '../../contexts/LanguageContext';
import Icon from '../ui/Icon';

/**
 * Adjuntos de una tarea o factura: los que ya tiene (se pueden quitar uno a uno)
 * y los que se van a subir. Antes, subir uno nuevo borraba todos los anteriores.
 */
export default function AttachmentsField({ existing = [], files = [], onRemoveExisting, onFilesChange }) {
  const { t } = useLanguage();

  return (
    <div className="field">
      <span className="field-label">{t('planning.attachFiles')}</span>

      {existing.length > 0 && (
        <ul className="file-list">
          {existing.map((file, index) => (
            <li key={file.path || file.url || index}>
              <Icon name="paperclip" size={14} />
              <span className="file-name">{file.name || `${index + 1}`}</span>
              <button
                type="button"
                className="icon-button danger"
                onClick={() => onRemoveExisting(index)}
                aria-label={t('planning.removeAttachment').replace('{name}', file.name || index + 1)}
              >
                <Icon name="close" size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}

      <input
        type="file"
        multiple
        className="input"
        style={{ marginTop: existing.length ? '0.5rem' : 0, fontSize: '0.8rem' }}
        onChange={(e) => onFilesChange(Array.from(e.target.files))}
        aria-label={t('planning.attachFiles')}
      />

      {files.length > 0 && (
        <p className="field-help">{t('planning.filesToUpload').replace('{names}', files.map(f => f.name).join(', '))}</p>
      )}
    </div>
  );
}
