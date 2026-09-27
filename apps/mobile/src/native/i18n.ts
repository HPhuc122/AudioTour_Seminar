import { createContext, useContext, useMemo } from "react"
import english from "./en.json"
import chinese from "./zh.json"
import korean from "./ko.json"
import japanese from "./ja.json"
import french from "./fr.json"

export const uiDictionaries: Record<string, Record<string, string>> = { en: english, zh: chinese, ko: korean, ja: japanese, fr: french }

export type Translator = (message: string, ...values: (string | number)[]) => string
export const UiLanguageContext = createContext<string | null>(null)

export function createTranslator(languageCode: string | null): Translator {
  const code = languageCode?.trim().toLowerCase().split(/[-_]/)[0] ?? "vi"
  const dictionary = uiDictionaries[code]
  return (message, ...values) => {
    const key = message.trim()
    const translated = dictionary?.[key]
    const text = translated === undefined ? message : message.replace(key, () => translated)
    return text.replace(/\{(\d+)\}/g, (token, index) => values[Number(index)] === undefined ? token : String(values[Number(index)]))
  }
}

export function useTranslator(): Translator {
  const language = useContext(UiLanguageContext)
  return useMemo(() => createTranslator(language), [language])
}
