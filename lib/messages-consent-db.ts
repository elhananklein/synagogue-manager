import { getSupabaseAdminClient } from "@/lib/supabase-server";
import { isCongregantGender, type CongregantGender, type CongregantMinyanOption } from "@/lib/congregant-types";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isMessagesToken(value: string | null | undefined): value is string {
  return UUID_RE.test(String(value ?? ""));
}

export type MessagesConsentView = {
  firstName: string;
  gender: CongregantGender;
  consent: boolean;
  synagogueName: string;
  minyan: CongregantMinyanOption | null;
};

type TokenRow = {
  id: string;
  first_name: string | null;
  gender: string | null;
  messages_consent: boolean | null;
  synagogues?: { name: string | null } | { name: string | null }[] | null;
  minyanim?:
    | { id: string; name: string | null; display_style: string | null; display_palette: string | null; display_font: string | null }
    | Array<{ id: string; name: string | null; display_style: string | null; display_palette: string | null; display_font: string | null }>
    | null;
};

function one<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? (value[0] ?? null) : (value ?? null);
}

function toView(row: TokenRow): MessagesConsentView {
  const minyan = one(row.minyanim);
  return {
    firstName: String(row.first_name ?? ""),
    gender: isCongregantGender(row.gender) ? row.gender : "male",
    consent: Boolean(row.messages_consent),
    synagogueName: String(one(row.synagogues)?.name ?? ""),
    minyan: minyan
      ? {
          id: String(minyan.id),
          name: String(minyan.name ?? ""),
          displayStyle: String(minyan.display_style ?? "classic"),
          displayPalette: minyan.display_palette ?? null,
          displayFont: minyan.display_font ?? null
        }
      : null
  };
}

const TOKEN_SELECT =
  "id, first_name, gender, messages_consent, synagogues(name), minyanim(id, name, display_style, display_palette, display_font)";

export async function getMessagesConsentByToken(token: string): Promise<MessagesConsentView | null> {
  if (!isMessagesToken(token)) return null;
  const supabase = getSupabaseAdminClient();
  if (!supabase) return null;
  const res = await supabase.from("congregants").select(TOKEN_SELECT).eq("messages_token", token).maybeSingle();
  if (res.error || !res.data) return null;
  return toView(res.data as unknown as TokenRow);
}

export async function setMessagesConsentByToken(token: string, consent: boolean): Promise<MessagesConsentView | null> {
  if (!isMessagesToken(token)) return null;
  const supabase = getSupabaseAdminClient();
  if (!supabase) return null;
  const res = await supabase
    .from("congregants")
    .update({
      messages_consent: consent,
      messages_consent_at: new Date().toISOString(),
      messages_consent_source: "link"
    })
    .eq("messages_token", token)
    .select(TOKEN_SELECT)
    .maybeSingle();
  if (res.error || !res.data) return null;
  return toView(res.data as unknown as TokenRow);
}
