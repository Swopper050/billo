import {
  createEffect,
  createMemo,
  createResource,
  createSignal,
  For,
  JSXElement,
  Show,
} from 'solid-js'
import { createStore, produce } from 'solid-js/store'
import { useNavigate, useParams } from '@solidjs/router'

import {
  createInvoice,
  getCompanySettings,
  getCustomerInvoicePdfUrl,
  getInvoice,
  listOrganizations,
  updateInvoice,
} from '../../api'
import { Button, IconButton } from '../../components/Button'
import { useLocale } from '../../context/LocaleProvider'
import { useWorkspace } from '../../context/WorkspaceProvider'
import { OrganizationAttributes } from '../../models/Contacts'
import {
  InvoiceAttributes,
  InvoiceInput,
  InvoiceLineInput,
  InvoiceStatus,
} from '../../models/Invoicing'

interface EditorState {
  organization_id: number | null
  invoice_number: string
  status: InvoiceStatus
  issue_date: string
  due_date: string
  currency: string
  vat_rate: string
  notes: string
  recipient_name: string
  recipient_email: string
  recipient_address_line1: string
  recipient_address_line2: string
  recipient_postal_code: string
  recipient_city: string
  recipient_country: string
  recipient_vat_number: string
  recipient_kvk_number: string
  lines: InvoiceLineInput[]
}

const EMPTY_LINE: InvoiceLineInput = {
  description: '',
  quantity: '1',
  unit_price: '0.00',
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

function defaultDueDate(): string {
  const d = new Date()
  d.setDate(d.getDate() + 14)
  return d.toISOString().slice(0, 10)
}

function emptyState(): EditorState {
  return {
    organization_id: null,
    invoice_number: '',
    status: 'draft',
    issue_date: todayIso(),
    due_date: defaultDueDate(),
    currency: 'EUR',
    vat_rate: '21.00',
    notes: '',
    recipient_name: '',
    recipient_email: '',
    recipient_address_line1: '',
    recipient_address_line2: '',
    recipient_postal_code: '',
    recipient_city: '',
    recipient_country: '',
    recipient_vat_number: '',
    recipient_kvk_number: '',
    lines: [{ ...EMPTY_LINE }],
  }
}

function fromInvoice(invoice: InvoiceAttributes): EditorState {
  return {
    organization_id: invoice.organization_id,
    invoice_number: invoice.invoice_number,
    status: invoice.status,
    issue_date: invoice.issue_date,
    due_date: invoice.due_date ?? '',
    currency: invoice.currency,
    vat_rate: invoice.vat_rate,
    notes: invoice.notes ?? '',
    recipient_name: invoice.recipient_name ?? '',
    recipient_email: invoice.recipient_email ?? '',
    recipient_address_line1: invoice.recipient_address_line1 ?? '',
    recipient_address_line2: invoice.recipient_address_line2 ?? '',
    recipient_postal_code: invoice.recipient_postal_code ?? '',
    recipient_city: invoice.recipient_city ?? '',
    recipient_country: invoice.recipient_country ?? '',
    recipient_vat_number: invoice.recipient_vat_number ?? '',
    recipient_kvk_number: invoice.recipient_kvk_number ?? '',
    lines:
      invoice.lines.length > 0
        ? invoice.lines.map((l) => ({
            description: l.description,
            quantity: l.quantity,
            unit_price: l.unit_price,
          }))
        : [{ ...EMPTY_LINE }],
  }
}

function applyOrganization(
  setForm: (...args: unknown[]) => void,
  org: OrganizationAttributes
) {
  setForm('recipient_name', org.name)
  setForm('recipient_email', org.email ?? '')
  setForm('recipient_address_line1', org.address_line1 ?? '')
  setForm('recipient_address_line2', org.address_line2 ?? '')
  setForm('recipient_postal_code', org.postal_code ?? '')
  setForm('recipient_city', org.city ?? '')
  setForm('recipient_country', org.country ?? '')
  setForm('recipient_vat_number', org.vat_number ?? '')
  setForm('recipient_kvk_number', org.kvk_number ?? '')
}

function moneyDisplay(amount: number, currency: string): string {
  if (Number.isNaN(amount)) return `${currency} 0.00`
  return `${currency} ${amount.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

export function InvoiceEditor(): JSXElement {
  const { t } = useLocale()
  const { currentWorkspace } = useWorkspace()
  const navigate = useNavigate()
  const params = useParams<{ id?: string }>()

  const workspaceId = () => currentWorkspace()?.id ?? 0
  const isEdit = () => !!params.id
  const invoiceId = () => (params.id ? Number(params.id) : null)

  const [form, setForm] = createStore<EditorState>(emptyState())
  const [saving, setSaving] = createSignal(false)
  const [submitError, setSubmitError] = createSignal<string | null>(null)

  const [organizations] = createResource(workspaceId, async (id) => {
    if (!id) return []
    return await listOrganizations(id)
  })

  const [companySettings] = createResource(workspaceId, async (id) => {
    if (!id) return null
    return await getCompanySettings(id)
  })

  const [existingInvoice] = createResource(
    () => (isEdit() ? { wsId: workspaceId(), id: invoiceId() } : null),
    async (key) => {
      if (!key || !key.wsId || !key.id) return null
      return await getInvoice(key.wsId, key.id)
    }
  )

  // Initialize form when editing or when settings load.
  createEffect(() => {
    const invoice = existingInvoice()
    if (invoice) {
      setForm(fromInvoice(invoice))
      return
    }
    if (isEdit()) return
    const settings = companySettings()
    if (settings) {
      setForm('vat_rate', settings.default_vat_rate)
    }
  })

  const handleOrgSelect = (orgId: number | null) => {
    setForm('organization_id', orgId)
    if (orgId === null) return
    const org = (organizations() ?? []).find((o) => o.id === orgId)
    if (org) {
      applyOrganization((path: unknown, value: unknown) => {
        setForm(path as keyof EditorState, value as never)
      }, org)
    }
  }

  const addLine = () => {
    setForm(
      'lines',
      produce((lines) => {
        lines.push({ ...EMPTY_LINE })
      })
    )
  }

  const removeLine = (index: number) => {
    setForm(
      'lines',
      produce((lines) => {
        if (lines.length <= 1) {
          lines[0] = { ...EMPTY_LINE }
        } else {
          lines.splice(index, 1)
        }
      })
    )
  }

  const updateLine = (
    index: number,
    field: keyof InvoiceLineInput,
    value: string
  ) => {
    setForm('lines', index, field, value)
  }

  const subtotal = createMemo(() => {
    return form.lines.reduce((sum, line) => {
      const qty = parseFloat(line.quantity || '0') || 0
      const price = parseFloat(line.unit_price || '0') || 0
      return sum + qty * price
    }, 0)
  })

  const vatRateNumber = () => parseFloat(form.vat_rate || '0') || 0
  const vatAmount = createMemo(() => (subtotal() * vatRateNumber()) / 100)
  const total = createMemo(() => subtotal() + vatAmount())

  const buildPayload = (): InvoiceInput => {
    const lines = form.lines
      .filter((l) => l.description.trim() !== '')
      .map((l) => ({
        description: l.description,
        quantity: l.quantity || '1',
        unit_price: l.unit_price || '0',
      }))

    return {
      organization_id: form.organization_id,
      invoice_number: form.invoice_number || null,
      status: form.status,
      issue_date: form.issue_date,
      due_date: form.due_date || null,
      currency: form.currency,
      vat_rate: form.vat_rate,
      notes: form.notes || null,
      lines,
      recipient_name: form.recipient_name,
      recipient_email: form.recipient_email || null,
      recipient_address_line1: form.recipient_address_line1 || null,
      recipient_address_line2: form.recipient_address_line2 || null,
      recipient_postal_code: form.recipient_postal_code || null,
      recipient_city: form.recipient_city || null,
      recipient_country: form.recipient_country || null,
      recipient_vat_number: form.recipient_vat_number || null,
      recipient_kvk_number: form.recipient_kvk_number || null,
    }
  }

  const handleSave = async (
    e: Event,
    options: { thenDownload?: boolean } = {}
  ) => {
    e.preventDefault()
    setSubmitError(null)
    if (!form.recipient_name.trim()) {
      setSubmitError(t('recipient_required'))
      return
    }
    if (form.lines.every((l) => l.description.trim() === '')) {
      setSubmitError(t('at_least_one_line_required'))
      return
    }
    const wsId = workspaceId()
    if (!wsId) return
    setSaving(true)
    try {
      const payload = buildPayload()
      const saved = isEdit()
        ? await updateInvoice(wsId, invoiceId()!, payload)
        : await createInvoice(wsId, payload)
      if (options.thenDownload) {
        const url = getCustomerInvoicePdfUrl(wsId, saved.id)
        const response = await fetch(url, { credentials: 'include' })
        if (response.ok) {
          const blob = await response.blob()
          const objectUrl = URL.createObjectURL(blob)
          const a = document.createElement('a')
          a.href = objectUrl
          a.download = `invoice-${saved.invoice_number || saved.id}.pdf`
          document.body.appendChild(a)
          a.click()
          a.remove()
          URL.revokeObjectURL(objectUrl)
        }
      }
      navigate('/invoices')
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : t('an_unknown_error_occurred')
      )
    } finally {
      setSaving(false)
    }
  }

  const showLogoMissingHint = () => {
    const settings = companySettings()
    return !!settings && !settings.logo_data_url
  }

  return (
    <div class="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
      <div class="max-w-5xl mx-auto">
        <div class="mb-6 flex items-center gap-3">
          <button
            class="btn btn-ghost btn-sm"
            onClick={() => navigate('/invoices')}
          >
            <i class="fa-solid fa-arrow-left mr-2" />
            {t('back')}
          </button>
          <h1 class="text-2xl font-bold">
            {isEdit() ? t('edit_invoice') : t('new_invoice')}
          </h1>
        </div>

        <Show when={showLogoMissingHint()}>
          <div class="alert alert-info mb-4 text-sm">
            <i class="fa-solid fa-circle-info" />
            <span>{t('company_settings_hint')}</span>
            <button
              class="btn btn-sm btn-ghost"
              onClick={() => navigate('/invoices/settings')}
            >
              {t('configure')}
            </button>
          </div>
        </Show>

        <form
          class="grid grid-cols-1 lg:grid-cols-3 gap-6"
          onSubmit={(e) => handleSave(e)}
        >
          <div class="lg:col-span-2 flex flex-col gap-6">
            <Section title={t('recipient')}>
              <div>
                <label class="label label-text">{t('select_klant')}</label>
                <select
                  class="select select-bordered w-full"
                  value={form.organization_id ?? ''}
                  onChange={(e) =>
                    handleOrgSelect(
                      e.currentTarget.value === ''
                        ? null
                        : Number(e.currentTarget.value)
                    )
                  }
                >
                  <option value="">{t('manual_recipient')}</option>
                  <For each={organizations() ?? []}>
                    {(org) => <option value={org.id}>{org.name}</option>}
                  </For>
                </select>
              </div>

              <Field
                label={t('recipient_name')}
                required
                value={form.recipient_name}
                onInput={(v) => setForm('recipient_name', v)}
              />
              <Field
                label={t('email')}
                value={form.recipient_email}
                onInput={(v) => setForm('recipient_email', v)}
              />
              <Field
                label={t('address_line1')}
                value={form.recipient_address_line1}
                onInput={(v) => setForm('recipient_address_line1', v)}
              />
              <Field
                label={t('address_line2')}
                value={form.recipient_address_line2}
                onInput={(v) => setForm('recipient_address_line2', v)}
              />
              <div class="grid grid-cols-3 gap-3">
                <Field
                  label={t('postal_code')}
                  value={form.recipient_postal_code}
                  onInput={(v) => setForm('recipient_postal_code', v)}
                />
                <Field
                  label={t('city')}
                  value={form.recipient_city}
                  onInput={(v) => setForm('recipient_city', v)}
                  class="col-span-2"
                />
              </div>
              <Field
                label={t('country')}
                value={form.recipient_country}
                onInput={(v) => setForm('recipient_country', v)}
              />
              <div class="grid grid-cols-2 gap-3">
                <Field
                  label={t('vat_number')}
                  value={form.recipient_vat_number}
                  onInput={(v) => setForm('recipient_vat_number', v)}
                />
                <Field
                  label={t('kvk_number')}
                  value={form.recipient_kvk_number}
                  onInput={(v) => setForm('recipient_kvk_number', v)}
                />
              </div>
            </Section>

            <Section title={t('invoice_lines')}>
              <div class="overflow-x-auto">
                <table class="table table-sm">
                  <thead>
                    <tr>
                      <th class="w-1/2">{t('description')}</th>
                      <th>{t('quantity')}</th>
                      <th>{t('unit_price')}</th>
                      <th class="text-end">{t('line_total')}</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    <For each={form.lines}>
                      {(line, index) => {
                        const lineTotal = () => {
                          const q = parseFloat(line.quantity || '0') || 0
                          const p = parseFloat(line.unit_price || '0') || 0
                          return q * p
                        }
                        return (
                          <tr>
                            <td>
                              <input
                                class="input input-bordered input-sm w-full"
                                value={line.description}
                                placeholder={t('line_description_placeholder')}
                                onInput={(e) =>
                                  updateLine(
                                    index(),
                                    'description',
                                    e.currentTarget.value
                                  )
                                }
                              />
                            </td>
                            <td>
                              <input
                                class="input input-bordered input-sm w-24"
                                type="number"
                                step="0.001"
                                value={line.quantity}
                                onInput={(e) =>
                                  updateLine(
                                    index(),
                                    'quantity',
                                    e.currentTarget.value
                                  )
                                }
                              />
                            </td>
                            <td>
                              <input
                                class="input input-bordered input-sm w-28"
                                type="number"
                                step="0.01"
                                value={line.unit_price}
                                onInput={(e) =>
                                  updateLine(
                                    index(),
                                    'unit_price',
                                    e.currentTarget.value
                                  )
                                }
                              />
                            </td>
                            <td class="text-end font-medium">
                              {moneyDisplay(lineTotal(), form.currency)}
                            </td>
                            <td class="text-end">
                              <IconButton
                                icon="fa-solid fa-trash"
                                size="sm"
                                color="error"
                                onClick={() => removeLine(index())}
                              />
                            </td>
                          </tr>
                        )
                      }}
                    </For>
                  </tbody>
                </table>
              </div>

              <div class="mt-2">
                <Button
                  variant="ghost"
                  size="sm"
                  icon="fa-solid fa-plus"
                  label={t('add_line')}
                  onClick={addLine}
                />
              </div>
            </Section>

            <Section title={t('notes')}>
              <textarea
                class="textarea textarea-bordered w-full"
                rows="3"
                placeholder={t('notes_placeholder')}
                value={form.notes}
                onInput={(e) => setForm('notes', e.currentTarget.value)}
              />
            </Section>
          </div>

          <div class="flex flex-col gap-6">
            <Section title={t('invoice_details')}>
              <Field
                label={t('invoice_number')}
                value={form.invoice_number}
                placeholder={t('invoice_number_placeholder')}
                onInput={(v) => setForm('invoice_number', v)}
              />
              <div>
                <label class="label label-text">{t('status')}</label>
                <select
                  class="select select-bordered w-full"
                  value={form.status}
                  onChange={(e) =>
                    setForm('status', e.currentTarget.value as InvoiceStatus)
                  }
                >
                  <option value="draft">{t('invoice_status_draft')}</option>
                  <option value="sent">{t('invoice_status_sent')}</option>
                  <option value="paid">{t('invoice_status_paid')}</option>
                </select>
              </div>
              <Field
                label={t('issue_date')}
                type="date"
                value={form.issue_date}
                onInput={(v) => setForm('issue_date', v)}
              />
              <Field
                label={t('due_date')}
                type="date"
                value={form.due_date}
                onInput={(v) => setForm('due_date', v)}
              />
              <div class="grid grid-cols-2 gap-3">
                <Field
                  label={t('currency')}
                  value={form.currency}
                  onInput={(v) => setForm('currency', v)}
                />
                <Field
                  label={t('vat_rate_percent')}
                  type="number"
                  value={form.vat_rate}
                  onInput={(v) => setForm('vat_rate', v)}
                />
              </div>
            </Section>

            <Section title={t('totals')}>
              <TotalRow
                label={t('subtotal')}
                value={moneyDisplay(subtotal(), form.currency)}
              />
              <TotalRow
                label={`${t('vat')} (${form.vat_rate}%)`}
                value={moneyDisplay(vatAmount(), form.currency)}
              />
              <div class="border-t border-base-300 pt-2 mt-2">
                <TotalRow
                  label={t('total')}
                  value={moneyDisplay(total(), form.currency)}
                  bold
                />
              </div>
            </Section>

            <Show when={submitError()}>
              <div class="alert alert-error text-sm">{submitError()}</div>
            </Show>

            <div class="flex flex-col gap-2">
              <Button
                type="submit"
                color="primary"
                block
                isLoading={saving()}
                icon="fa-solid fa-save"
                label={t('save_invoice')}
              />
              <Button
                variant="outline"
                color="primary"
                block
                isLoading={saving()}
                icon="fa-solid fa-download"
                label={t('save_and_download_pdf')}
                onClick={(e) => handleSave(e!, { thenDownload: true })}
              />
              <Button
                variant="ghost"
                block
                label={t('cancel')}
                onClick={() => navigate('/invoices')}
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
  type?: 'text' | 'email' | 'date' | 'number'
  required?: boolean
  placeholder?: string
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
        placeholder={props.placeholder}
        value={props.value}
        onInput={(e) => props.onInput(e.currentTarget.value)}
      />
    </div>
  )
}

function TotalRow(props: {
  label: string
  value: string
  bold?: boolean
}): JSXElement {
  return (
    <div
      class={
        props.bold
          ? 'flex items-center justify-between text-base font-bold'
          : 'flex items-center justify-between text-sm'
      }
    >
      <span class={props.bold ? '' : 'text-base-content/70'}>
        {props.label}
      </span>
      <span>{props.value}</span>
    </div>
  )
}
