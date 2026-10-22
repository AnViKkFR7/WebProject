import { useEffect, useRef } from 'react'
import { useBeforeUnload, useBlocker, useLocation, useNavigate, useParams } from 'react-router-dom'

export function useDocumentNavigation({ dirty, saving, confirm, t, base }) {
  const navigate = useNavigate()
  const location = useLocation()
  const { '*': routeId = '' } = useParams()
  const bypass = useRef(false)
  const alive = useRef(true)
  const asking = useRef(false)
  useEffect(() => { alive.current = true; return () => { alive.current = false } }, [])
  const blocker = useBlocker(({ currentLocation, nextLocation }) =>
    !bypass.current && (dirty || saving) && currentLocation.pathname !== nextLocation.pathname)
  useEffect(() => {
    if (blocker.state !== 'blocked' || asking.current) return
    if (saving) { blocker.reset(); return }
    asking.current = true
    Promise.resolve(confirm({ title:t('documentWorkspace.leaveTitle'), message:t('documentWorkspace.leaveMessage'), confirmLabel:t('documentWorkspace.discard'), danger:true }))
      .then(discard => {
        if (!alive.current) return
        if (discard) blocker.proceed()
        else blocker.reset()
      }).finally(() => { asking.current = false })
  }, [blocker, saving, confirm, t])
  useBeforeUnload(event => {
    if (dirty || saving) { event.preventDefault(); event.returnValue = '' }
  })
  const go = (path, { completed = false, state } = {}) => {
    bypass.current = completed
    navigate(`${base}${path}${location.search}`, { state, replace:completed || path === '' })
    // The blocker reads the ref synchronously during navigate; future navigation is guarded again.
    bypass.current = false
  }
  return { routeId, location, go }
}
