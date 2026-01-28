import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabaseClient.js'

const buildRelativeTime = (value) => {
  const date = value ? new Date(value) : null
  if (!date || Number.isNaN(date.getTime())) return 'Sin fecha'
  const diffMs = Date.now() - date.getTime()
  const minutes = Math.floor(diffMs / 60000)
  if (minutes < 1) return 'Hace un momento'
  if (minutes < 60) return `Hace ${minutes} min`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `Hace ${hours} h`
  const days = Math.floor(hours / 24)
  if (days < 30) return `Hace ${days} d`
  const months = Math.floor(days / 30)
  if (months < 12) return `Hace ${months} m`
  const years = Math.floor(months / 12)
  return `Hace ${years} a`
}

const Dashboard = () => {
  const [stats, setStats] = useState({
    itemsPublished: 0,
    companies: 0,
    users: 0,
    postsPublished: 0,
  })
  const [statusCounts, setStatusCounts] = useState({
    published: 0,
    draft: 0,
    archived: 0,
    total: 0,
  })
  const [activity, setActivity] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const useSupabase =
      import.meta.env.VITE_USE_SUPABASE === 'true' && Boolean(supabase)

    if (!useSupabase) {
      setLoading(false)
      setError('Conexión a Supabase pendiente de activación.')
      setStats({
        itemsPublished: 0,
        companies: 0,
        users: 0,
        postsPublished: 0,
      })
      setStatusCounts({
        published: 0,
        draft: 0,
        archived: 0,
        total: 0,
      })
      setActivity([])
      return
    }

    const fetchDashboard = async () => {
      setLoading(true)
      setError('')

      const [
        itemsPublished,
        companies,
        users,
        postsPublished,
        itemsTotal,
        itemsDraft,
        itemsArchived,
      ] = await Promise.all([
        supabase.from('items').select('id', { count: 'exact', head: true }).eq('status', 'published'),
        supabase.from('companies').select('id', { count: 'exact', head: true }),
        supabase.from('user_profiles').select('id', { count: 'exact', head: true }),
        supabase.from('blog_posts').select('id', { count: 'exact', head: true }).eq('status', 'published'),
        supabase.from('items').select('id', { count: 'exact', head: true }),
        supabase.from('items').select('id', { count: 'exact', head: true }).eq('status', 'draft'),
        supabase.from('items').select('id', { count: 'exact', head: true }).eq('status', 'archived'),
      ])

      const errorMessage =
        itemsPublished.error ||
        companies.error ||
        users.error ||
        postsPublished.error ||
        itemsTotal.error ||
        itemsDraft.error ||
        itemsArchived.error

      if (errorMessage) {
        setError('No se pudo cargar el dashboard desde Supabase.')
        setLoading(false)
        return
      }

      setStats({
        itemsPublished: itemsPublished.count ?? 0,
        companies: companies.count ?? 0,
        users: users.count ?? 0,
        postsPublished: postsPublished.count ?? 0,
      })

      setStatusCounts({
        published: itemsPublished.count ?? 0,
        draft: itemsDraft.count ?? 0,
        archived: itemsArchived.count ?? 0,
        total: itemsTotal.count ?? 0,
      })

      const [recentItems, recentPosts] = await Promise.all([
        supabase
          .from('items')
          .select('id, title, updated_at')
          .order('updated_at', { ascending: false })
          .limit(5),
        supabase
          .from('blog_posts')
          .select('id, title, updated_at')
          .order('updated_at', { ascending: false })
          .limit(5),
      ])

      if (!recentItems.error && !recentPosts.error) {
        const combined = [
          ...(recentItems.data ?? []).map((item) => ({
            id: `item-${item.id}`,
            type: 'Item',
            title: item.title,
            updatedAt: item.updated_at,
          })),
          ...(recentPosts.data ?? []).map((post) => ({
            id: `blog-${post.id}`,
            type: 'Blog',
            title: post.title,
            updatedAt: post.updated_at,
          })),
        ]
          .sort(
            (a, b) =>
              new Date(b.updatedAt ?? 0).getTime() -
              new Date(a.updatedAt ?? 0).getTime()
          )
          .slice(0, 5)

        setActivity(combined)
      }

      setLoading(false)
    }

    fetchDashboard()
  }, [])

  const progress = useMemo(() => {
    const total = statusCounts.total || 0
    if (!total) {
      return { published: 0, draft: 0, archived: 0 }
    }
    return {
      published: Math.round((statusCounts.published / total) * 100),
      draft: Math.round((statusCounts.draft / total) * 100),
      archived: Math.round((statusCounts.archived / total) * 100),
    }
  }, [statusCounts])

  return (
    <div className="page-content">
      <section className="page-header">
        <div>
          <h2>Resumen general</h2>
          <p>Vista rápida de la actividad de tus empresas y contenidos.</p>
        </div>
        <div className="header-actions">
          <button className="primary-button">Nuevo item</button>
          <button className="ghost-button">Nueva empresa</button>
        </div>
      </section>

      {error && <div className="alert error">{error}</div>}

      <section className="stats-grid">
        <div className="card stat-card">
          <p className="stat-label">Items publicados</p>
          <h3>{loading ? '—' : stats.itemsPublished}</h3>
          <span className="stat-trend neutral">Datos en tiempo real</span>
        </div>
        <div className="card stat-card">
          <p className="stat-label">Empresas activas</p>
          <h3>{loading ? '—' : stats.companies}</h3>
          <span className="stat-trend neutral">Datos en tiempo real</span>
        </div>
        <div className="card stat-card">
          <p className="stat-label">Usuarios</p>
          <h3>{loading ? '—' : stats.users}</h3>
          <span className="stat-trend neutral">Datos en tiempo real</span>
        </div>
        <div className="card stat-card">
          <p className="stat-label">Posts publicados</p>
          <h3>{loading ? '—' : stats.postsPublished}</h3>
          <span className="stat-trend neutral">Datos en tiempo real</span>
        </div>
      </section>

      <section className="grid-2">
        <div className="card">
          <div className="card-header">
            <h3>Actividad reciente</h3>
            <button className="ghost-button small">Ver todo</button>
          </div>
          {loading ? (
            <p className="muted">Cargando actividad...</p>
          ) : activity.length === 0 ? (
            <p className="muted">Sin actividad reciente.</p>
          ) : (
            <ul className="activity-list">
              {activity.map((entry) => (
                <li key={entry.id}>
                  <span className="badge">{entry.type}</span>
                  <div>
                    <strong>{entry.title}</strong>
                    <p>Actualizado · {buildRelativeTime(entry.updatedAt)}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="card">
          <div className="card-header">
            <h3>Items por estado</h3>
            <button className="ghost-button small">Configurar</button>
          </div>
          {loading ? (
            <p className="muted">Cargando distribución...</p>
          ) : (
            <div className="progress-list">
              <div>
                <div className="progress-label">
                  <span>Publicado</span>
                  <span>{progress.published}%</span>
                </div>
                <div className="progress-bar">
                  <div className="progress-fill" style={{ width: `${progress.published}%` }} />
                </div>
              </div>
              <div>
                <div className="progress-label">
                  <span>Borrador</span>
                  <span>{progress.draft}%</span>
                </div>
                <div className="progress-bar">
                  <div className="progress-fill warning" style={{ width: `${progress.draft}%` }} />
                </div>
              </div>
              <div>
                <div className="progress-label">
                  <span>Archivado</span>
                  <span>{progress.archived}%</span>
                </div>
                <div className="progress-bar">
                  <div className="progress-fill neutral" style={{ width: `${progress.archived}%` }} />
                </div>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  )
}

export default Dashboard
