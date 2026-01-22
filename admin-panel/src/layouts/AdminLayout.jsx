import { Outlet } from 'react-router-dom'
import Sidebar from '../components/Sidebar.jsx'
import Topbar from '../components/Topbar.jsx'

const AdminLayout = () => {
  return (
    <div className="app-shell">
      <Sidebar />
      <div className="app-main">
        <Topbar />
        <main className="page">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

export default AdminLayout
