import { cookies } from "next/headers";

type MessageParams = Record<string, string | number>;

const caches: Record<string, Record<string, string>> = {};

async function loadMessages(locale: string): Promise<Record<string, string>> {
  if (caches[locale]) return caches[locale];
  const mod = await import(`../../messages/${locale}.json`);
  const messages = flattenMessages(mod.default);
  caches[locale] = messages;
  return messages;
}

function flattenMessages(obj: Record<string, unknown>, prefix = ""): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (typeof value === "string") {
      result[fullKey] = value;
    } else if (typeof value === "object" && value !== null) {
      Object.assign(result, flattenMessages(value as Record<string, unknown>, fullKey));
    }
  }
  return result;
}

export async function getApiT() {
  const cookieStore = await cookies();
  const locale = cookieStore.get("NEXT_LOCALE")?.value || "zh";
  const validLocale = ["zh", "en"].includes(locale) ? locale : "zh";
  const messages = await loadMessages(validLocale);

  return (key: string, params?: MessageParams): string => {
    let msg = messages[key] || key;
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        msg = msg.replace(`{${k}}`, String(v));
      }
    }
    return msg;
  };
}
