/**
 * Table module API: Supabase Realtime client for the campaign table room channel.
 * Channel subscription logic stays in useTableRealtime; only client access lives here.
 */
import { createClient } from '@/lib/supabase'
import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js'

export function getTableSupabaseClient(): SupabaseClient {
  return createClient()
}

export function removeTableRoomChannel(client: SupabaseClient, channel: RealtimeChannel) {
  return client.removeChannel(channel)
}