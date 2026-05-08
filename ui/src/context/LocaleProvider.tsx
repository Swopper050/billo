import { JSXElement, createContext, useContext } from 'solid-js'

import * as i18n from '@solid-primitives/i18n'

import type * as en from '../locales/en'
import { dict as defaultDict } from '../locales/en'

export type TranslationKeys = typeof en.dict
export type TranslationKey = keyof TranslationKeys
export type Translations = i18n.Flatten<TranslationKeys>

const flat: Translations = i18n.flatten(defaultDict)

type LocaleContextType = {
  translations: () => Translations
  t: i18n.Translator<Translations>
}

const LocaleContext = createContext<LocaleContextType>()

export function LocaleProvider(props: { children: JSXElement }) {
  const t = i18n.translator(() => flat)

  return (
    <LocaleContext.Provider value={{ translations: () => flat, t }}>
      {props.children}
    </LocaleContext.Provider>
  )
}

export function useLocale() {
  const context = useContext(LocaleContext)
  if (!context)
    throw new Error('useLocale must be used within an LocaleProvider')
  return context
}
