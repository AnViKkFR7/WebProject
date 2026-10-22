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
import { FeedbackProvider } from './contexts/FeedbackContext.jsx'

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
const Blog = lazy(() => import('./pages/Blog.jsx'))
const Invoicing = lazy(() => import('./pages/Invoicing.jsx'))
const Planning = lazy(() => import('./pages/Planning.jsx'))
const Profile = lazy(() => import('./pages/Profile.jsx'))
const PrivacyPolicy = lazy(() => import('./pages/PrivacyPolicy.jsx'))
const LegalNotice = lazy(() => import('./pages/LegalNotice.jsx'))
const CookiesPolicy = lazy(() => import('./pages/CookiesPolicy.jsx'))
const NotFound = lazy(() => import('./pages/NotFound.jsx'))

const router = createBrowserRouter(createRoutesFromElements(
  <Route errorElement={<RouteErrorView/>} element={<FeedbackProvider><Suspense fallback={<RouteFallback />}><Outlet /></Suspense></FeedbackProvider>}>
            <Route path="/login" element={<Login />} />
            <Route path="/reset-password" element={<ResetPassword />} />

            <Route element={<AuthGuard />}>
              <Route element={<CompanyProvider><AdminLayout /></CompanyProvider>}>
                <Route path="/" element={<Dashboard />} />
                <Route path="/profile/:tab?" element={<Profile />} />
                <Route path="/privacy-policy" element={<PrivacyPolicy />} />
                <Route path="/legal-notice" element={<LegalNotice />} />
                <Route path="/cookies-policy" element={<CookiesPolicy />} />
                <Route path="/items" element={<Items />} />
                <Route path="/items/:itemId" element={<ItemDetail />} />
                <Route path="/analytics" element={<Analytics />} />
                <Route path="/my-data" element={<MyData />} />
                <Route path="/companies" element={<Companies />} />
                <Route path="/users" element={<Users />} />
                <Route path="/leads" element={<Leads />} />
                <Route path="/blog" element={<Blog />} />
                <Route path="/quotes/*" element={<Invoicing kind="quote" />} />
                <Route path="/invoicing/*" element={<Invoicing />} />
                <Route path="/planning" element={<Planning />} />
                <Route path="*" element={<NotFound />} />
              </Route>
            </Route>
  </Route>
))

const App = () => <RouterProvider router={router}/>

export default App
