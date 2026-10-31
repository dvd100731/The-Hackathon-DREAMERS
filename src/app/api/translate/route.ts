import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { GLOSSARY } from "@/lib/glossary";
import { LANGUAGES } from "@/lib/constants";
import { logDatabaseError, logServerError } from "@/lib/error-logging";

const languageCodes = LANGUAGES.map(({ code }) => code);
const languageCodeSchema = z.enum(languageCodes as [string, ...string[]]);
const translationsSchema = z.object({
  en: z.string(),
  vi: z.string(),
  zh: z.string(),
  ru: z.string(),
  ja: z.string(),
}).strict();
const meaningsSchema = z.object({
  ko: z.string().min(1),
  en: z.string().min(1),
  vi: z.string().min(1),
  zh: z.string().min(1),
  ru: z.string().min(1),
  ja: z.string().min(1),
}).strict();

const requestSchema = z.object({
  captionId: z.string().uuid(),
  original: z.string().trim().min(1).max(5000),
  scene: z.enum(["school", "safety", "university", "religion", "tourism", "other"]),
  languages: z.array(languageCodeSchema).min(1).max(languageCodes.length).optional(),
}).strict();

const resultSchema = z.object({
  translations: translationsSchema,
  terms: z.array(z.object({
    term: z.string().min(1),
    meaning: meaningsSchema,
  }).strict()),
}).strict();

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Supabase server configuration is missing.");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export async function POST(request: Request) {
  const parsedRequest = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsedRequest.success) return Response.json({ error: "Invalid translation request." }, { status: 400 });

  const { captionId, original, scene } = parsedRequest.data;
  const supabase = getSupabase();
  const { data: caption, error: lookupError } = await supabase
    .from("captions").select("id,original,room_code").eq("id", captionId).maybeSingle();
  if (lookupError) {
    logDatabaseError("api/translate caption lookup failed", lookupError);
    return Response.json({ error: "Could not load this caption." }, { status: 500 });
  }
  if (!caption) return Response.json({ error: "Caption was not found." }, { status: 404 });
  if (caption.original !== original) return Response.json({ error: "Caption text does not match." }, { status: 409 });

  const { data: room, error: roomError } = await supabase
    .from("rooms").select("scene").eq("code", caption.room_code).maybeSingle();
  if (roomError) {
    logDatabaseError("api/translate room lookup failed", roomError);
    return Response.json({ error: "Could not load the meeting room." }, { status: 500 });
  }
  if (!room || room.scene !== scene) return Response.json({ error: "Room type does not match." }, { status: 409 });
  const selectedLanguages = parsedRequest.data.languages ?? languageCodes;

  const { error: statusError } = await supabase
    .from("captions").update({ translation_status: "translating" }).eq("id", captionId);
  if (statusError) {
    logDatabaseError("api/translate status update failed", statusError);
    return Response.json({ error: "Could not update translation status." }, { status: 500 });
  }

  try {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not configured.");
    const anthropic = new Anthropic({ apiKey });
    const glossary = GLOSSARY[scene];
    const response = await anthropic.messages.parse({
      model: process.env.ANTHROPIC_MODEL || "claude-haiku-5-5",
      max_tokens: 3000,
      output_config: { format: zodOutputFormat(resultSchema) },
      system: [
        `Translate the supplied Korean caption into these languages: ${selectedLanguages.map((code: string) => `${LANGUAGES.find((language) => language.code === code)?.name} (${code})`).join(", ")}. For unselected languages, use an empty string in translation and term meaning fields.`,
        `Return only one valid JSON object with this exact shape: ${JSON.stringify({ translations: Object.fromEntries(languageCodes.map((code) => [code, ""])), terms: [{ term: "", meaning: { ko: "", ...Object.fromEntries(languageCodes.map((code) => [code, ""])) } }] })}.`,
        "Only include glossary terms that actually occur in the Korean source. Match a glossary term even when Korean particles are attached. For glossary terms, copy the supplied easy Korean meaning exactly into meaning.ko; translate that meaning into selected languages. For terms absent from the glossary, provide a short easy Korean explanation and translate it into selected languages.",
        "Preserve every date, number, deadline, time, and numeric format exactly as written in the Korean source in all translations. Do not add facts. If no listed term occurs, return an empty terms array.",
      ].join(" "),
      messages: [{
        role: "user",
        content: JSON.stringify({ scene, glossary, original }),
      }],
    });

    const result = resultSchema.parse(response.parsed_output);
    const glossaryEntries = new Map(glossary.map((entry) => [entry.term, entry.meaning]));
    for (const term of result.terms) {
      const knownMeaning = glossaryEntries.get(term.term);
      if (knownMeaning) term.meaning.ko = knownMeaning;
    }

    const { error: updateError } = await supabase.from("captions").update({
      translations: result.translations,
      terms: result.terms,
      translation_status: "completed",
    }).eq("id", captionId);
    if (updateError) {
      logDatabaseError("api/translate result update failed", updateError);
      throw updateError;
    }
    return Response.json({ status: "completed", ...result });
  } catch (error) {
    await supabase.from("captions").update({ translation_status: "failed" }).eq("id", captionId);
    logServerError("api/translate model request failed", error);
    return Response.json({ status: "failed", error: "Translation failed. The Korean caption was kept." }, { status: 502 });
  }
}
