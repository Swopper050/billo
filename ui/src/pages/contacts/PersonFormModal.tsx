import { createEffect, For, JSXElement } from 'solid-js'
import { createStore } from 'solid-js/store'

import { Button } from '../../components/Button'
import { Modal } from '../../components/Modal'
import { useLocale } from '../../context/LocaleProvider'
import {
  OrganizationAttributes,
  PersonAttributes,
  PersonInput,
} from '../../models/Contacts'

const EMPTY: PersonInput = {
  first_name: '',
  last_name: '',
  email: '',
  phone: '',
  role: '',
  organization_id: null,
  notes: '',
}

function toInput(person: PersonAttributes | null): PersonInput {
  if (!person) return { ...EMPTY }
  return {
    first_name: person.first_name,
    last_name: person.last_name ?? '',
    email: person.email ?? '',
    phone: person.phone ?? '',
    role: person.role ?? '',
    organization_id: person.organization_id ?? null,
    notes: person.notes ?? '',
  }
}

export function PersonFormModal(props: {
  isOpen: boolean
  person: PersonAttributes | null
  organizations: OrganizationAttributes[]
  onClose: () => void
  onSave: (data: PersonInput) => Promise<void>
}): JSXElement {
  const { t } = useLocale()
  const [form, setForm] = createStore<PersonInput>({ ...EMPTY })

  createEffect(() => {
    if (props.isOpen) {
      setForm(toInput(props.person))
    }
  })

  const handleSubmit = async (e: Event) => {
    e.preventDefault()
    if (!form.first_name.trim()) return
    await props.onSave({ ...form })
  }

  const title = () => (props.person ? t('edit_person') : t('add_person'))

  return (
    <Modal title={title()} isOpen={props.isOpen} onClose={props.onClose}>
      <form class="mt-4 flex flex-col gap-3" onSubmit={handleSubmit}>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label class="label label-text">
              {t('first_name')}
              <span class="text-error ml-1">*</span>
            </label>
            <input
              class="input input-bordered w-full"
              required
              value={form.first_name}
              onInput={(e) => setForm('first_name', e.currentTarget.value)}
            />
          </div>
          <div>
            <label class="label label-text">{t('last_name')}</label>
            <input
              class="input input-bordered w-full"
              value={form.last_name ?? ''}
              onInput={(e) => setForm('last_name', e.currentTarget.value)}
            />
          </div>
        </div>

        <div>
          <label class="label label-text">{t('organization')}</label>
          <select
            class="select select-bordered w-full"
            value={form.organization_id ?? ''}
            onChange={(e) => {
              const v = e.currentTarget.value
              setForm('organization_id', v === '' ? null : Number(v))
            }}
          >
            <option value="">{t('no_organization')}</option>
            <For each={props.organizations}>
              {(org) => <option value={org.id}>{org.name}</option>}
            </For>
          </select>
        </div>

        <div>
          <label class="label label-text">{t('role')}</label>
          <input
            class="input input-bordered w-full"
            value={form.role ?? ''}
            onInput={(e) => setForm('role', e.currentTarget.value)}
            placeholder={t('role_placeholder')}
          />
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label class="label label-text">{t('email')}</label>
            <input
              class="input input-bordered w-full"
              type="email"
              value={form.email ?? ''}
              onInput={(e) => setForm('email', e.currentTarget.value)}
            />
          </div>
          <div>
            <label class="label label-text">{t('phone')}</label>
            <input
              class="input input-bordered w-full"
              value={form.phone ?? ''}
              onInput={(e) => setForm('phone', e.currentTarget.value)}
            />
          </div>
        </div>

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
