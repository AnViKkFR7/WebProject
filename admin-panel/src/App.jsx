import { Suspense, lazy } from 'react'
import { createBrowserRouter, createRoutesFromElements, RouterProvider, Route, Outlet } from 'react-router-dom'
import './App.css'
import './styles/forms.css'
import AdminLayout from './layouts/AdminLayout.jsx'
import AuthGuard from './components/AuthGuard.jsx'
import RouteFallback from './components/RouteFallback.jsx'
import RouteErrorView from './components/RouteErrorView.jsx'
import Login from './pages/Login.jsx'
import Dashboard from './pages/Dashboard.jsx'
import { CompanyProvider } from './contexts/CompanyContext.jsx'
import { CompanyModulesProvider } from './contexts/CompanyModulesContext.jsx'
import { FeedbackProvider } from './contexts/FeedbackContext.jsx'
import RequireModule from './components/RequireModule.jsx'
import ButtonTooltipManager from './components/ButtonTooltipManager.jsx'

// El resto de páginas se descargan al entrar en ellas. Analítica (gráficas),
// Planning (calendario) y Atributos (Excel) son las que más pesan, y antes se
// descargaban aunque solo abrieras Items.
const ResetPassword = lazy(() => import('./pages/ResetPassword.jsx'))
const Items = lazy(() => import('./pages/Items.jsx'))
const ItemDetail = lazy(() => import('./pages/ItemDetail.jsx'))
const Analytics = lazy(() => import('./pages/Analytics.jsx'))
const MyData = lazy(() => import('./pages/MyData.jsx'))
const Companies = lazy(() => import('./pages/Companies.jsx'))
const Users = lazy(() => import('./pages/Users.jsx'))
const Leads = lazy(() => import('./pages/Leads.jsx'))
const Contacts = lazy(() => import('./pages/Contacts.jsx'))
const ModuleSettings = lazy(() => import('./pages/ModuleSettings.jsx'))
const CrmPrivacy = lazy(() => import('./pages/CrmPrivacy.jsx'))
const CustomerEmailSettings = lazy(() => import('./pages/CustomerEmailSettings.jsx'))
const Blog = lazy(() => import('./pages/Blog.jsx'))
const Invoicing = lazy(() => import('./pages/Invoicing.jsx'))
const QuoteApproval = lazy(() => import('./pages/QuoteApproval.jsx'))
const Planning = lazy(() => import('./pages/Planning.jsx'))
const Profile = lazy(() => import('./pages/Profile.jsx'))
const PrivacyPolicy = lazy(() => import('./pages/PrivacyPolicy.jsx'))
const LegalNotice = lazy(() => import('./pages/LegalNotice.jsx'))
const CookiesPolicy = lazy(() => import('./pages/CookiesPolicy.jsx'))
const NotFound = lazy(() => import('./pages/NotFound.jsx'))
const DeveloperGallery = import.meta.env.DEV ? lazy(() => import('./pages/DeveloperGallery.jsx')) : null

const router = createBrowserRouter(createRoutesFromElements(
  <Route errorElement={<RouteErrorView/>} element={<FeedbackProvider><ButtonTooltipManager/><Suspense fallback={<RouteFallback />}><Outlet /></Suspense></FeedbackProvider>}>
            <Route path="/login" element={<Login />} />
            <Route path="/quotes/respond" element={<QuoteApproval />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            {import.meta.env.DEV && <Route path="/__dev/gallery" element={<DeveloperGallery />} />}

            <Route element={<AuthGuard />}>
              <Route element={<CompanyProvider><CompanyModulesProvider><AdminLayout /></CompanyModulesProvider></CompanyProvider>}>
                <Route path="/" element={<Dashboard />} />
                <Route path="/profile/:tab?" element={<Profile />} />
                <Route path="/privacy-policy" element={<PrivacyPolicy />} />
                <Route path="/legal-notice" element={<LegalNotice />} />
                <Route path="/cookies-policy" element={<CookiesPolicy />} />
                <Route path="/items" element={<RequireModule module="items"><Items /></RequireModule>} />
                <Route path="/items/:itemId" element={<RequireModule module="items"><ItemDetail /></RequireModule>} />
                <Route path="/analytics" element={<RequireModule module="analytics"><Analytics /></RequireModule>} />
                <Route path="/my-data" element={<RequireModule module="items"><MyData /></RequireModule>} />
                <Route path="/companies" element={<Companies />} />
                <Route path="/users" element={<Users />} />
                <Route path="/settings/modules" element={<ModuleSettings />} />
                <Route path="/settings/privacy" element={<CrmPrivacy />} />
                <Route path="/settings/emails" element={<RequireModule module="billing"><CustomerEmailSettings /></RequireModule>} />
                <Route path="/leads" element={<RequireModule module="crm"><Leads /></RequireModule>} />
                <Route path="/contacts" element={<RequireModule module="crm"><Contacts /></RequireModule>} />
                <Route path="/blog" element={<RequireModule module="blog"><Blog /></RequireModule>} />
                <Route path="/quotes/*" element={<RequireModule module="billing"><Invoicing kind="quote" /></RequireModule>} />
                <Route path="/invoicing/*" element={<RequireModule module="billing"><Invoicing /></RequireModule>} />
                <Route path="/planning" element={<RequireModule module="planning"><Planning /></RequireModule>} />
                <Route path="*" element={<NotFound />} />
              </Route>
            </Route>
  </Route>
))

const App = () => <RouterProvider router={router}/>

export default App
