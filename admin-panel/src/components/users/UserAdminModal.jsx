import { useEffect, useState } from 'react'
import { companyService } from '../../services/companyService'
import { useLanguage } from '../../contexts/LanguageContext'
import Modal from '../ui/Modal'
import CreateUserTab from '../profile/CreateUserTab'
import AssignUserTab from '../profile/AssignUserTab'

const CONTENT = {
  create: { Component: CreateUserTab, prefix: 'profile.createUser' },
  assign: { Component: AssignUserTab, prefix: 'profile.assignUser' },
}

/** Alta y asignación de usuarios (antes, pestañas escondidas en /profile). Solo admin de plataforma. */
const UserAdminModal = ({ mode, onClose }) => {
  const { t } = useLanguage()
  const [companies, setCompanies] = useState([])

  useEffect(() => {
    if (!mode) return undefined
    let cancelled = false
    companyService.getAllCompanies()
      .then((data) => { if (!cancelled) setCompanies(data) })
      .catch((error) => console.error('Error cargando empresas:', error))
    return () => { cancelled = true }
  }, [mode])

  const content = CONTENT[mode]

  return (
    <Modal
      open={Boolean(content)}
      onClose={onClose}
      size="lg"
      className="embedded-tab-modal"
      title={content && t(`${content.prefix}.title`)}
      description={content && t(`${content.prefix}.description`)}
    >
      {content && <content.Component companies={companies} />}
    </Modal>
  )
}

export default UserAdminModal
