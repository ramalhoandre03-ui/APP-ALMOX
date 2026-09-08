import { createClient } from '@supabase/supabase-js';

const baseUrl = 'https://uvlgbjbvfrhoyhthhfwc.supabase.co';
const part1 = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV2';
const part2 = 'bGdiamJ2ZnJob3lodGhoZndjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI0NDM4MjAsImV4';
const part3 = 'cCI6MjA5ODAxOTgyMH0.j_BEYTc1iv4ppcPHoR6KMh7Iix5RVoJ7TQA8k4C4zkY';

// Injeção direta forçada. PROIBIDO usar process.env ou import.meta.env
export const supabase = createClient(baseUrl, part1 + part2 + part3);
