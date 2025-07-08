
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://otusuyqrbduhhgolfpdv.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im90dXN1eXFyYmR1aGhnb2xmcGR2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTE4NTcyNTksImV4cCI6MjA2NzQzMzI1OX0.7BN0087npvcsnxgqoA8J7S0J5Mx76NfDyFr4eVLH98s'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
