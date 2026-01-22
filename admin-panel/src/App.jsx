import { BrowserRouter, Route, Routes } from 'react-router-dom'
import './App.css'
import AdminLayout from './layouts/AdminLayout.jsx'
import Blog from './pages/Blog.jsx'
import Companies from './pages/Companies.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Items from './pages/Items.jsx'
import Media from './pages/Media.jsx'
import NotFound from './pages/NotFound.jsx'
import Settings from './pages/Settings.jsx'
import Users from './pages/Users.jsx'

const App = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AdminLayout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/items" element={<Items />} />
          <Route path="/companies" element={<Companies />} />
          <Route path="/users" element={<Users />} />
          <Route path="/blog" element={<Blog />} />
          <Route path="/media" element={<Media />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App
