// lib/supabase.ts
import { createBrowserClient } from '@supabase/ssr'

export const createClient = () => 
  createBrowserClient(
    'https://klhxbaagarqxaqnrvurr.supabase.co',
    'sb_publishable_DEqlrxf3M7MzsoSkrEuBXQ_ndTxg9e1'
  )