import { getLocales } from "expo-localization";

function normalize(code: string): string {
  return code.trim().replaceAll("_", "-").toLocaleLowerCase();
}

/**
 * Matches a user's ordered language preferences to language codes that the
 * current QR-accessible content supports. No fallback language is invented:
 * callers must show the language picker when this returns null.
 */
export function matchPreferredLanguage(
  preferredCodes: readonly string[],
  supportedCodes: readonly string[],
): string | null {
  const supported = new Map(supportedCodes.map((code) => [normalize(code), code]));

  for (const preferredCode of preferredCodes) {
    const normalized = normalize(preferredCode);
    const exactMatch = supported.get(normalized);
    if (exactMatch) return exactMatch;

    const languageCode = normalized.split("-")[0];
    const languageMatch = supported.get(languageCode);
    if (languageMatch) return languageMatch;
  }

  return null;
}

/**
 * Resolves the phone's locale preferences at QR time against languages
 * returned by the backend for that content. A null result means the UI must
 * ask the guest to select a language.
 */
export function resolveDeviceLanguage(supportedCodes: readonly string[]): string | null {
  const preferredCodes = getLocales().flatMap((locale) =>
    [locale.languageTag, locale.languageCode].filter((code): code is string => Boolean(code)),
  );

  return matchPreferredLanguage(preferredCodes, supportedCodes);
}