"use client";

import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

// Supabase's anon key and project URL are public browser configuration.
const fallbackUrl = "https://hwtgczdulkufkggyffra.supabase.co";
const fallbackAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh3dGdjemR1bGt1ZmtnZ3lmZnJhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM0MjExMzUsImV4cCI6MjEwODk5NzEzNX0.WzlYEgm2ExmiljE4OQ9TMndtlEx3D4ZxDjoirGx5GyE";

export async function createSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || fallbackUrl;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || fallbackAnonKey;
  if (!url || !anon || url.startsWith("__SUPABASE_") || anon.startsWith("__SUPABASE_")) return null;
  return createClient<Database>(url, anon);
}
