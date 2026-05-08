import {
  createEffect,
  createResource,
  createSignal,
  JSXElement,
  Show,
} from 'solid-js'
import { createStore } from 'solid-js/store'

import { getCompanySettings, updateCompanySettings } from '../../api'
import { Button } from '../../components/Button'
import { useLocale } from '../../context/LocaleProvider'
import { useWorkspace } from '../../context/WorkspaceProvider'
import { CompanySettingsInput } from '../../models/Invoicing'

const EMPTY: CompanySettingsInput = {
  company_name: '',
  email: '',
  phone: '',
  website: '',
  vat_number: '',
  kvk_number: '',
  iban: '',
  address_line1: '',
  address_line2: '',
  postal_code: '',
  city: '',
  country: '',
  default_vat_rate: '21.00',
  invoice_prefix: '',
  next_invoice_number: 1,
  footer_text: '',
  logo_data_url: null,
}

const MAX_LOGO_BYTES = 1_500_000 // ~1.5 MB

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

export function CompanySettingsPage(): JSXElement {
  const { t } = useLocale()
  const { currentWorkspace } = useWorkspace()
  const workspaceId = () => currentWorkspace()?.id ?? 0

  const [settings] = createResource(workspaceId, async (id) => {
    if (!id) return null
    return await getCompanySettings(id)
  })

  const [form, setForm] = createStore<CompanySettingsInput>({ ...EMPTY })
  const [saving, setSaving] = createSignal(false)
  const [savedAt, setSavedAt] = createSignal<Date | null>(null)
  const [logoError, setLogoError] = createSignal<string | null>(null)

  createEffect(() => {
    const s = settings()
    if (s) {
      setForm({
        company_name: s.company_name ?? '',
        email: s.email ?? '',
        phone: s.phone ?? '',
        website: s.website ?? '',
        vat_number: s.vat_number ?? '',
        kvk_number: s.kvk_number ?? '',
        iban: s.iban ?? '',
        address_line1: s.address_line1 ?? '',
        address_line2: s.address_line2 ?? '',
        postal_code: s.postal_code ?? '',
        city: s.city ?? '',
        country: s.country ?? '',
        default_vat_rate: s.default_vat_rate ?? '21.00',
        invoice_prefix: s.invoice_prefix ?? '',
        next_invoice_number: s.next_invoice_number ?? 1,
        footer_text: s.footer_text ?? '',
        logo_data_url: s.logo_data_url ?? null,
      })
    }
  })

  const handleLogoChange = async (e: Event) => {
    setLogoError(null)
    const input = e.currentTarget as HTMLInputElement
    const file = input.files?.[0]
    if (!file) return
    if (!['image/png', 'image/jpeg', 'image/gif'].includes(file.type)) {
      setLogoError(t('logo_invalid_type'))
      input.value = ''
      return
    }
    if (file.size > MAX_LOGO_BYTES) {
      setLogoError(t('logo_too_large'))
      input.value = ''
      return
    }
    const dataUrl = await readFileAsDataUrl(file)
    setForm('logo_data_url', dataUrl)
  }

  const handleSubmit = async (e: Event) => {
    e.preventDefault()
    const id = workspaceId()
    if (!id) return
    setSaving(true)
    try {
      await updateCompanySettings(id, { ...form })
      setSavedAt(new Date())
    } finally {
      setSaving(false)
    }
  }

  return (
    <div class="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
      <div class="max-w-3xl mx-auto">
        <div class="mb-6">
          <h1 class="text-2xl font-bold">{t('my_company')}</h1>
          <p class="text-base-content/60 text-sm mt-1">
            {t('company_settings_subtitle')}
          </p>
        </div>

        <form class="flex flex-col gap-6" onSubmit={handleSubmit}>
          <Section title={t('company_logo')}>
            <div class="flex items-start gap-4">
              <div class="w-32 h-32 border border-base-300 rounded-2xl flex items-center justify-center bg-base-200 overflow-hidden">
                <Show
                  when={form.logo_data_url}
                  fallback={
                    <i class="fa-solid fa-image text-3xl text-base-content/30" />
                  }
                >
                  <img
                    src={form.logo_data_url ?? ''}
                    alt="logo"
                    class="max-w-full max-h-full object-contain"
                  />
                </Show>
              </div>
              <div class="flex-1">
                <input
                  type="file"
                  class="file-input file-input-bordered w-full"
                  accept="image/png,image/jpeg,image/gif"
                  onChange={handleLogoChange}
                />
                <p class="text-xs text-base-content/60 mt-1">
                  {t('logo_help')}
                </p>
                <Show when={logoError()}>
                  <div class="text-error text-xs mt-1">{logoError()}</div>
                </Show>
                <Show when={form.logo_data_url}>
                  <button
                    type="button"
                    class="btn btn-ghost btn-xs mt-2"
                    onClick={() => setForm('logo_data_url', null)}
                  >
                    <i class="fa-solid fa-trash mr-1" />
                    {t('remove_logo')}
                  </button>
                </Show>
              </div>
            </div>
          </Section>

          <Section title={t('company_details')}>
            <Field
              label={t('company_name')}
              value={form.company_name ?? ''}
              onInput={(v) => setForm('company_name', v)}
            />
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field
                label={t('email')}
                type="email"
                value={form.email ?? ''}
                onInput={(v) => setForm('email', v)}
              />
              <Field
                label={t('phone')}
                value={form.phone ?? ''}
                onInput={(v) => setForm('phone', v)}
              />
            </div>
            <Field
              label={t('website')}
              value={form.website ?? ''}
              onInput={(v) => setForm('website', v)}
            />
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field
                label={t('vat_number')}
                value={form.vat_number ?? ''}
                onInput={(v) => setForm('vat_number', v)}
              />
              <Field
                label={t('kvk_number')}
                value={form.kvk_number ?? ''}
                onInput={(v) => setForm('kvk_number', v)}
              />
            </div>
            <Field
              label={t('iban')}
              value={form.iban ?? ''}
              onInput={(v) => setForm('iban', v)}
            />
            <Field
              label={t('address_line1')}
              value={form.address_line1 ?? ''}
              onInput={(v) => setForm('address_line1', v)}
            />
            <Field
              label={t('address_line2')}
              value={form.address_line2 ?? ''}
              onInput={(v) => setForm('address_line2', v)}
            />
            <div class="grid grid-cols-3 gap-3">
              <Field
                label={t('postal_code')}
                value={form.postal_code ?? ''}
                onInput={(v) => setForm('postal_code', v)}
              />
              <Field
                label={t('city')}
                value={form.city ?? ''}
                onInput={(v) => setForm('city', v)}
                class="col-span-2"
              />
            </div>
            <Field
              label={t('country')}
              value={form.country ?? ''}
              onInput={(v) => setForm('country', v)}
            />
          </Section>

          <Section title={t('invoice_defaults')}>
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Field
                label={t('invoice_prefix')}
                value={form.invoice_prefix ?? ''}
                placeholder="INV-"
                onInput={(v) => setForm('invoice_prefix', v)}
              />
              <Field
                label={t('next_invoice_number')}
                type="number"
                value={String(form.next_invoice_number ?? 1)}
                onInput={(v) => setForm('next_invoice_number', Number(v) || 1)}
              />
              <Field
                label={t('default_vat_rate')}
                type="number"
                value={form.default_vat_rate ?? ''}
                onInput={(v) => setForm('default_vat_rate', v)}
              />
            </div>
            <div>
              <label class="label label-text">{t('footer_text')}</label>
              <textarea
                class="textarea textarea-bordered w-full"
                rows="2"
                value={form.footer_text ?? ''}
                onInput={(e) => setForm('footer_text', e.currentTarget.value)}
                placeholder={t('footer_text_placeholder')}
              />
            </div>
          </Section>

          <div class="flex items-center justify-between">
            <Show when={savedAt()}>
              <span class="text-sm text-success">
                <i class="fa-solid fa-check mr-1" />
                {t('saved')}
              </span>
            </Show>
            <div class="ml-auto flex gap-2">
              <Button
                type="submit"
                color="primary"
                isLoading={saving()}
                label={t('save')}
              />
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}

function Section(props: {
  title: string
  children: JSXElement | JSXElement[]
}): JSXElement {
  return (
    <div class="border border-base-300 rounded-2xl p-4">
      <h2 class="font-semibold mb-3">{props.title}</h2>
      <div class="flex flex-col gap-3">{props.children}</div>
    </div>
  )
}

function Field(props: {
  label: string
  value: string
  onInput: (v: string) => void
  type?: 'text' | 'email' | 'number'
  placeholder?: string
  class?: string
}): JSXElement {
  return (
    <div class={props.class}>
      <label class="label label-text">{props.label}</label>
      <input
        class="input input-bordered w-full"
        type={props.type ?? 'text'}
        placeholder={props.placeholder}
        value={props.value}
        onInput={(e) => props.onInput(e.currentTarget.value)}
      />
    </div>
  )
}
