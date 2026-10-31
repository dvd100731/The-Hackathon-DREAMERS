export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];
export type CaptionTranslations = Record<string, string>;
export type CaptionTerm = { term: string; meaning: Record<string, string> };

export interface Database {
  public: {
    Tables: {
      rooms: { Row: { id: string; code: string; title: string; scene: string; status: "live" | "ended"; translation_languages: string[]; created_at: string }; Insert: { id?: string; code: string; title: string; scene: string; status?: "live" | "ended"; translation_languages?: string[]; created_at?: string }; Update: Partial<Database["public"]["Tables"]["rooms"]["Insert"]>; Relationships: [] };
      captions: { Row: { id: string; room_code: string; original: string; translations: CaptionTranslations; terms: CaptionTerm[]; translation_status: "pending" | "translating" | "completed" | "failed"; created_at: string }; Insert: { id?: string; room_code: string; original: string; translations?: CaptionTranslations; terms?: CaptionTerm[]; translation_status?: "pending" | "translating" | "completed" | "failed"; created_at?: string }; Update: Partial<Database["public"]["Tables"]["captions"]["Insert"]>; Relationships: [] };
      summaries: { Row: { id: string; room_code: string; language: string; summary: Json; todos: Json; is_public: boolean; created_at: string }; Insert: { id?: string; room_code: string; language: string; summary?: Json; todos?: Json; is_public?: boolean; created_at?: string }; Update: Partial<Database["public"]["Tables"]["summaries"]["Insert"]>; Relationships: [] };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
