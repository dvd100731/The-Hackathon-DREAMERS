"use client";

import { useEffect, useState } from "react";
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
    const supabase = createSupabaseClient();
    if (!supabase || !roomCode) return;

    let active = true;
    const sessionId = crypto.randomUUID();
    const channel = supabase.channel(`room-presence-${roomCode}`, {
      config: { presence: { key: sessionId } },
    });

    channel.on("presence", { event: "sync" }, () => {
      if (!active) return;
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
      if (status === "SUBSCRIBED" && language) {
        void channel.track({ language });
      }
    });

    return () => {
      active = false;
      void channel.untrack();
      void supabase.removeChannel(channel);
    };
  }, [language, roomCode]);

  return counts;
}
