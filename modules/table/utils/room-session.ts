import type { TableRole } from '../types'

export function getRoomFromLocation() {
  if (typeof window === 'undefined') return 'campaign-666'
  return new URLSearchParams(window.location.search).get('room')
    || window.localStorage.getItem('vtm-table-room')
    || 'campaign-666'
}

export function getRoleFromLocation(): TableRole | null {
  if (typeof window === 'undefined') return null
  const role = new URLSearchParams(window.location.search).get('role')
  return role === 'master' || role === 'player' ? role : null
}

export function rememberRoom(room: string) {
  window.localStorage.setItem('vtm-table-room', room)
}

export function rememberTableRole(role: TableRole) {
  window.localStorage.setItem('vtm-table-role', role)
}

export function clearTableRole() {
  window.localStorage.removeItem('vtm-table-role')
}