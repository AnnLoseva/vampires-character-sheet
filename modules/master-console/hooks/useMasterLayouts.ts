'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { fetchMasterLayouts } from '../api'
import { MASTER_LAYOUTS } from '../persistence/constants'
import type { MasterLayout } from '../persistence/types'

export function useMasterLayouts(room: string) {
  const [layouts, setLayouts] = useState<MasterLayout[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!room) return

    const client = createClient()
    let cancelled = false

    const load = async () => {
      try {
        const next = await fetchMasterLayouts(room)
        if (!cancelled) {
          setLayouts(next)
          setError(null)
          setLoading(false)
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : 'Failed to load master layouts')
          setLoading(false)
        }
      }
    }

    void load()
    const channel = client
      .channel(`master-layouts:${room}:${crypto.randomUUID()}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: MASTER_LAYOUTS, filter: `room=eq.${room}` },
        () => void load(),
      )
      .subscribe()

    return () => {
      cancelled = true
      void client.removeChannel(channel)
    }
  }, [room])

  return { layouts, loading, error }
}
