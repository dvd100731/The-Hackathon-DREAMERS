"use client";

import { useEffect, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { LANGUAGES } from "@/lib/constants";
import { createSupabaseClient } from "@/lib/supabase-browser";

type PresenceMeta = { language?: string };
type PresenceCounts = { total: number; byLanguage: Record<string, number> };

const emptyCounts = (): PresenceCounts => ({
  total: 0,
  byLanguage: Object.fromEntries(LANGUAGES.map(({ code }) => [code, 0])),
});

export function useRoomPresence(roomCode: string, language?: string) {
  const [counts, setCounts] = useState<PresenceCounts>(emptyCounts);

  useEffect(() => {
    let active = true;
    let supabase: Awaited<ReturnType<typeof createSupabaseClient>> = null;
    let channel: RealtimeChannel | null = null;
    const connect = async () => {
      supabase = await createSupabaseClient();
      if (!active || !supabase || !roomCode) return;
      const sessionId = crypto.randomUUID();
      channel = supabase.channel(`room-presence-${roomCode}`, {
        config: { presence: { key: sessionId } },
      });

      channel.on("presence", { event: "sync" }, () => {
        if (!active || !channel) return;
        const next = emptyCounts();
        const presence = channel.presenceState<PresenceMeta>();
        for (const entries of Object.values(presence)) {
          for (const entry of entries) {
            if (!entry.language) continue;
            next.total += 1;
            if (entry.language in next.byLanguage) next.byLanguage[entry.language] += 1;
          }
        }
        setCounts(next);
      });

      channel.subscribe((status) => {
        if (status === "SUBSCRIBED" && language && channel) {
          void channel.track({ language });
        }
      });
    };
    void connect();

    return () => {
      active = false;
      if (channel && supabase) {
        void channel.untrack();
        void supabase.removeChannel(channel);
      }
    };
  }, [language, roomCode]);

  return counts;
}
