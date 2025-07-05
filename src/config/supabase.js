
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://xznllagxqpgcwhgcblys.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh6bmxsYWd4cXBnY3doZ2NibHlzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTE2ODMyMDYsImV4cCI6MjA2NzI1OTIwNn0.BmXtL2Mhac3bggyBBipLjj2_m8jiybTVgMAAvfR0Kuk'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
