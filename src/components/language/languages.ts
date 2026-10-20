export type Language = {
  code: string;
  name: string;
  nativeName: string;
  // Native name is written right-to-left.
  rtl?: boolean;
};

// TODO(i18n): replace with expo-localization + an i18n library; default code
// should come from the device locale (Localization.getLocales()[0]).
export const LANGUAGES: readonly Language[] = [
  { code: "EN", name: "English", nativeName: "English" },
  { code: "FR", name: "French", nativeName: "Français" },
  { code: "TW", name: "Twi", nativeName: "Twi" },
  { code: "EE", name: "Ewe", nativeName: "Eʋegbe" },
  { code: "HA", name: "Hausa", nativeName: "Harshen Hausa" },
  { code: "PCM", name: "Nigerian Pidgin", nativeName: "Naija Pidgin" },
  { code: "PT", name: "Portuguese", nativeName: "Português" },
  { code: "AR", name: "Arabic", nativeName: "العربية", rtl: true },
];

export function getLanguage(code: string): Language | undefined {
  return LANGUAGES.find((l) => l.code === code);
}

// English name for a code, or the code itself if unknown.
export function getLanguageName(code: string): string {
  return getLanguage(code)?.name ?? code;
}
