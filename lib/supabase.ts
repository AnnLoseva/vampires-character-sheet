// lib/supabase.ts
import { createBrowserClient } from '@supabase/ssr'
import { SpeedInsights } from "@vercel/speed-insights/next"



export const createClient = () => 
  createBrowserClient(
    'https://klhxbaagarqxaqnrvurr.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtsaHhiYWFnYXJxeGFxbnJ2dXJyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgwNzkwNjAsImV4cCI6MjA5MzY1NTA2MH0.Cy2496DJgJhqZkERL9h19FkiiTfkcW2pauPaJU5r5oY'
     
  )

  export const showSpeedInsights = SpeedInsights;

