import { createClient } from '@supabase/supabase-js'

// Replace these with YOUR actual values from Supabase dashboard
const supabaseUrl = 'https://xgpzjkjcqohebsiyofol.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhncHpqa2pjcW9oZWJzaXlvZm9sIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA1MzQ1MDYsImV4cCI6MjA3NjExMDUwNn0.Dlm26WcwP8vu01XlrQ15owcpt3fkhfS0U5R43cUFsgA'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
