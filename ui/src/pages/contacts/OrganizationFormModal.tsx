import { createEffect, JSXElement } from 'solid-js'
import { createStore } from 'solid-js/store'

import { Button } from '../../components/Button'
import { Modal } from '../../components/Modal'
import { useLocale } from '../../context/LocaleProvider'
import {
  OrganizationAttributes,
  OrganizationInput,
} from '../../models/Contacts'

const EMPTY: OrganizationInput = {
  name: '',
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
  notes: '',
}

function toInput(org: OrganizationAttributes | null): OrganizationInput {
  if (!org) return { ...EMPTY }
  return {
    name: org.name ?? '',
    email: org.email ?? '',
    phone: org.phone ?? '',
    website: org.website ?? '',
    vat_number: org.vat_number ?? '',
    kvk_number: org.kvk_number ?? '',
    iban: org.iban ?? '',
    address_line1: org.address_line1 ?? '',
    address_line2: org.address_line2 ?? '',
    postal_code: org.postal_code ?? '',
    city: org.city ?? '',
    country: org.country ?? '',
    notes: org.notes ?? '',
  }
}

export function OrganizationFormModal(props: {
  isOpen: boolean
  organization: OrganizationAttributes | null
  onClose: () => void
  onSave: (data: OrganizationInput) => Promise<void>
}): JSXElement {
  const { t } = useLocale()
  const [form, setForm] = createStore<OrganizationInput>({ ...EMPTY })

  createEffect(() => {
    if (props.isOpen) {
      setForm(toInput(props.organization))
    }
  })

  const handleSubmit = async (e: Event) => {
    e.preventDefault()
    if (!form.name.trim()) return
    await props.onSave({ ...form })
  }

  const title = () => (props.organization ? t('edit_klant') : t('add_klant'))

  return (
    <Modal title={title()} isOpen={props.isOpen} onClose={props.onClose}>
      <form class="mt-4 flex flex-col gap-3" onSubmit={handleSubmit}>
        <Field
          label={t('company_name')}
          required
          value={form.name}
          onInput={(v) => setForm('name', v)}
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
        <div>
          <label class="label label-text">{t('notes')}</label>
          <textarea
            class="textarea textarea-bordered w-full"
            rows="2"
            value={form.notes ?? ''}
            onInput={(e) => setForm('notes', e.currentTarget.value)}
          />
        </div>

        <div class="modal-action">
          <Button variant="ghost" label={t('cancel')} onClick={props.onClose} />
          <Button type="submit" color="primary" label={t('save')} />
        </div>
      </form>
    </Modal>
  )
}

function Field(props: {
  label: string
  value: string
  onInput: (v: string) => void
  type?: 'text' | 'email'
  required?: boolean
  class?: string
}): JSXElement {
  return (
    <div class={props.class}>
      <label class="label label-text">
        {props.label}
        {props.required && <span class="text-error ml-1">*</span>}
      </label>
      <input
        class="input input-bordered w-full"
        type={props.type ?? 'text'}
        required={props.required}
        value={props.value}
        onInput={(e) => props.onInput(e.currentTarget.value)}
      />
    </div>
  )
}
