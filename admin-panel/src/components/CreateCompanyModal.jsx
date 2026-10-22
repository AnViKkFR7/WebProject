import { useLanguage } from '../contexts/LanguageContext'
import { useCompany } from '../contexts/CompanyContext'
import Modal from './ui/Modal'
import CreateCompanyTab from './profile/CreateCompanyTab'

/** Alta de empresa del panel (tenant). Se abre desde el selector de empresa. */
const CreateCompanyModal = ({ open, onClose }) => {
  const { t } = useLanguage()
  const { reload } = useCompany()

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      className="embedded-tab-modal"
      title={t('profile.createCompany.title')}
      description={t('profile.createCompany.description')}
    >
      <CreateCompanyTab onCompanyCreated={reload} />
    </Modal>
  )
}

export default CreateCompanyModal
