import { createContext, useContext, useMemo } from "react"
import english from "./en.json"

export type Translator = (message: string, ...values: (string | number)[]) => string
export const UiLanguageContext = createContext<string | null>(null)

export function createTranslator(languageCode: string | null): Translator {
  const isEnglish = languageCode?.toLowerCase().split(/[-_]/)[0] === "en"
  return (message, ...values) => {
    const key = message.trim()
    const translated = isEnglish ? (english as Record<string, string>)[key] : undefined
    const text = translated === undefined ? message : message.replace(key, () => translated)
    return text.replace(/\{(\d+)\}/g, (token, index) => values[Number(index)] === undefined ? token : String(values[Number(index)]))
  }
}

export function useTranslator(): Translator {
  const language = useContext(UiLanguageContext)
  return useMemo(() => createTranslator(language), [language])
}
