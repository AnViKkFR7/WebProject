import { BrowserRouter, Route, Routes } from 'react-router-dom'
import './App.css'
import AdminLayout from './layouts/AdminLayout.jsx'
import Blog from './pages/Blog.jsx'
import Companies from './pages/Companies.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Items from './pages/Items.jsx'
import ItemDetail from './pages/ItemDetail.jsx'
import Media from './pages/Media.jsx'
import NotFound from './pages/NotFound.jsx'
import MyData from './pages/MyData.jsx'
import Users from './pages/Users.jsx'
import Login from './pages/Login.jsx'
import ResetPassword from './pages/ResetPassword.jsx'
import Profile from './pages/Profile.jsx'
import PrivacyPolicy from './pages/PrivacyPolicy.jsx'
import LegalNotice from './pages/LegalNotice.jsx'
import CookiesPolicy from './pages/CookiesPolicy.jsx'
import AuthGuard from './components/AuthGuard.jsx'
import { CompanyProvider } from './contexts/CompanyContext.jsx'

const App = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        
        <Route element={<AuthGuard />}>
          <Route element={<CompanyProvider><AdminLayout /></CompanyProvider>}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/privacy-policy" element={<PrivacyPolicy />} />
            <Route path="/legal-notice" element={<LegalNotice />} />
            <Route path="/cookies-policy" element={<CookiesPolicy />} />
            <Route path="/items" element={<Items />} />
            <Route path="/items/:itemId" element={<ItemDetail />} />
            <Route path="/my-data" element={<MyData />} />
            <Route path="/companies" element={<Companies />} />
            <Route path="/users" element={<Users />} />
            <Route path="/blog" element={<Blog />} />
            <Route path="/media" element={<Media />} />
            <Route path="*" element={<NotFound />} />
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App
