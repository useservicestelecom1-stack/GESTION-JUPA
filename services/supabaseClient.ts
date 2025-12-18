
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ctlocrcnbbnfeqtnikoo.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN0bG9jcmNuYmJuZmVxdG5pa29vIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQzMzk4MzksImV4cCI6MjA3OTkxNTgzOX0.8xFXby_4qzL3XgBux4_feuF-L5fGDJp3FX625P8tbB4';

export const supabase = createClient(supabaseUrl, supabaseKey);
