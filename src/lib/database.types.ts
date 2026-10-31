export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Database {
  public: {
    Tables: {
      rooms: { Row: { id: string; code: string; title: string; scene: string; status: "live" | "ended"; created_at: string }; Insert: { id?: string; code: string; title: string; scene: string; status?: "live" | "ended"; created_at?: string }; Update: Partial<Database["public"]["Tables"]["rooms"]["Insert"]> };
      captions: { Row: { id: string; room_code: string; original: string; translations: Json; terms: Json; created_at: string }; Insert: { id?: string; room_code: string; original: string; translations?: Json; terms?: Json; created_at?: string }; Update: Partial<Database["public"]["Tables"]["captions"]["Insert"]> };
      summaries: { Row: { id: string; room_code: string; language: string; summary: Json; todos: Json; is_public: boolean; created_at: string }; Insert: { id?: string; room_code: string; language: string; summary?: Json; todos?: Json; is_public?: boolean; created_at?: string }; Update: Partial<Database["public"]["Tables"]["summaries"]["Insert"]> };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
