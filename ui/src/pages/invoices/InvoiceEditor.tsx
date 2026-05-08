import {
  createEffect,
  createMemo,
  createResource,
  createSignal,
  For,
  JSXElement,
  Show,
} from 'solid-js'
import { createStore, produce, SetStoreFunction } from 'solid-js/store'
import { A, useNavigate, useParams } from '@solidjs/router'

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
  CompanySettingsAttributes,
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
  notes: string
  lines: InvoiceLineInput[]
}

function emptyLine(defaultVat: string): InvoiceLineInput {
  return {
    description: '',
    quantity: '1',
    unit_price: '0.00',
    vat_rate: defaultVat,
  }
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

function defaultDueDate(): string {
  const d = new Date()
  d.setDate(d.getDate() + 14)
  return d.toISOString().slice(0, 10)
}

function emptyState(defaultVat: string): EditorState {
  return {
    organization_id: null,
    invoice_number: '',
    status: 'draft',
    issue_date: todayIso(),
    due_date: defaultDueDate(),
    currency: 'EUR',
    notes: '',
    lines: [emptyLine(defaultVat)],
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
    notes: invoice.notes ?? '',
    lines:
      invoice.lines.length > 0
        ? invoice.lines.map((l) => ({
            description: l.description,
            quantity: l.quantity,
            unit_price: l.unit_price,
            vat_rate: l.vat_rate,
          }))
        : [emptyLine(invoice.vat_rate)],
  }
}

function formatMoney(amount: number, currency: string): string {
  if (Number.isNaN(amount)) amount = 0
  return `${currency} ${amount.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

function formatDate(value: string | null): string {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  return d.toLocaleDateString()
}

interface VatBucket {
  rate: number
  net: number
  vat: number
}

function computeBreakdown(lines: InvoiceLineInput[]): VatBucket[] {
  const map = new Map<number, number>()
  for (const line of lines) {
    if (!line.description.trim()) continue
    const qty = parseFloat(line.quantity || '0') || 0
    const price = parseFloat(line.unit_price || '0') || 0
    const rate = parseFloat(line.vat_rate || '0') || 0
    const net = qty * price
    map.set(rate, (map.get(rate) ?? 0) + net)
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => a - b)
    .map(([rate, net]) => ({
      rate,
      net,
      vat: (net * rate) / 100,
    }))
}

export function InvoiceEditor(): JSXElement {
  const { t } = useLocale()
  const { currentWorkspace } = useWorkspace()
  const navigate = useNavigate()
  const params = useParams<{ id?: string }>()

  const workspaceId = () => currentWorkspace()?.id ?? 0
  const isEdit = () => !!params.id
  const invoiceId = () => (params.id ? Number(params.id) : null)

  const [form, setForm] = createStore<EditorState>(emptyState('21.00'))
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

  // When editing, hydrate from the existing invoice. When creating, seed VAT
  // from company settings once they load.
  createEffect(() => {
    const invoice = existingInvoice()
    if (invoice) {
      setForm(fromInvoice(invoice))
      return
    }
    if (isEdit()) return
    const settings = companySettings()
    if (settings) {
      setForm(
        'lines',
        form.lines.map((l) =>
          l.vat_rate === '21.00'
            ? { ...l, vat_rate: settings.default_vat_rate }
            : l
        )
      )
    }
  })

  const selectedOrg = () => {
    const id = form.organization_id
    if (id === null) return null
    return (organizations() ?? []).find((o) => o.id === id) ?? null
  }

  const addLine = () => {
    setForm(
      'lines',
      produce((lines) => {
        lines.push(emptyLine(form.lines[0]?.vat_rate ?? '21.00'))
      })
    )
  }

  const removeLine = (index: number) => {
    setForm(
      'lines',
      produce((lines) => {
        if (lines.length <= 1) {
          lines[0] = emptyLine(form.lines[0]?.vat_rate ?? '21.00')
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

  const subtotal = createMemo(() =>
    form.lines.reduce((sum, line) => {
      if (!line.description.trim()) return sum
      const qty = parseFloat(line.quantity || '0') || 0
      const price = parseFloat(line.unit_price || '0') || 0
      return sum + qty * price
    }, 0)
  )

  const breakdown = createMemo(() => computeBreakdown(form.lines))
  const vatTotal = createMemo(() =>
    breakdown().reduce((sum, b) => sum + b.vat, 0)
  )
  const total = createMemo(() => subtotal() + vatTotal())

  const settingsValue = (): CompanySettingsAttributes | null =>
    companySettings() ?? null

  const buildPayload = (): InvoiceInput => {
    const lines = form.lines
      .filter((l) => l.description.trim() !== '')
      .map((l) => ({
        description: l.description,
        quantity: l.quantity || '1',
        unit_price: l.unit_price || '0',
        vat_rate: l.vat_rate || '0',
      }))

    return {
      organization_id: form.organization_id,
      invoice_number: form.invoice_number || null,
      status: form.status,
      issue_date: form.issue_date,
      due_date: form.due_date || null,
      currency: form.currency,
      notes: form.notes || null,
      lines,
    }
  }

  const handleSave = async (
    e: Event | undefined,
    options: { thenDownload?: boolean } = {}
  ) => {
    e?.preventDefault?.()
    setSubmitError(null)
    if (form.organization_id === null) {
      setSubmitError(t('please_select_a_klant'))
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

  const noKlanten = () => (organizations() ?? []).length === 0
  const showCompanyHint = () => {
    const s = settingsValue()
    return !!s && !s.company_name
  }

  return (
    <div class="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
      <div class="max-w-5xl mx-auto">
        <div class="mb-6 flex items-center justify-between gap-3 flex-wrap">
          <div class="flex items-center gap-3">
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
          <div class="flex gap-2">
            <Button
              variant="ghost"
              label={t('cancel')}
              onClick={() => navigate('/invoices')}
            />
            <Button
              variant="outline"
              color="primary"
              icon="fa-solid fa-download"
              isLoading={saving()}
              label={t('save_and_download_pdf')}
              onClick={(e) => handleSave(e, { thenDownload: true })}
            />
            <Button
              type="button"
              color="primary"
              icon="fa-solid fa-save"
              isLoading={saving()}
              label={t('save_invoice')}
              onClick={(e) => handleSave(e)}
            />
          </div>
        </div>

        <Show when={noKlanten()}>
          <div class="alert alert-warning mb-4 text-sm">
            <i class="fa-solid fa-triangle-exclamation" />
            <span>{t('no_klanten_for_invoice')}</span>
            <A class="btn btn-sm btn-ghost" href="/contacts">
              {t('manage_contacts')}
            </A>
          </div>
        </Show>

        <Show when={showCompanyHint()}>
          <div class="alert alert-info mb-4 text-sm">
            <i class="fa-solid fa-circle-info" />
            <span>{t('company_settings_hint')}</span>
            <A class="btn btn-sm btn-ghost" href="/company">
              {t('configure')}
            </A>
          </div>
        </Show>

        <Show when={submitError()}>
          <div class="alert alert-error text-sm mb-4">{submitError()}</div>
        </Show>

        <InvoicePreview
          settings={settingsValue()}
          form={form}
          setForm={setForm}
          subtotal={subtotal()}
          breakdown={breakdown()}
          total={total()}
          organizations={organizations() ?? []}
          selectedOrg={selectedOrg()}
          onOrgChange={(id) => setForm('organization_id', id)}
          onLineUpdate={updateLine}
          onLineRemove={removeLine}
          onAddLine={addLine}
        />
      </div>
    </div>
  )
}

interface PreviewProps {
  settings: CompanySettingsAttributes | null
  form: EditorState
  setForm: SetStoreFunction<EditorState>
  subtotal: number
  breakdown: VatBucket[]
  total: number
  organizations: OrganizationAttributes[]
  selectedOrg: OrganizationAttributes | null
  onOrgChange: (id: number | null) => void
  onLineUpdate: (
    index: number,
    field: keyof InvoiceLineInput,
    value: string
  ) => void
  onLineRemove: (index: number) => void
  onAddLine: () => void
}

function InvoicePreview(props: PreviewProps): JSXElement {
  const { t } = useLocale()
  return (
    <div class="bg-base-100 border border-base-300 rounded-2xl shadow-sm overflow-hidden">
      <div class="h-1 bg-success" />

      <div class="p-6 md:p-10 flex flex-col gap-8">
        {/* Header */}
        <div class="flex flex-col md:flex-row gap-6 md:items-start md:justify-between">
          <div class="flex items-start gap-4">
            <div class="w-20 h-20 rounded-xl bg-base-200 border border-base-300 flex items-center justify-center overflow-hidden shrink-0">
              <Show
                when={props.settings?.logo_data_url}
                fallback={
                  <i class="fa-solid fa-image text-2xl text-base-content/30" />
                }
              >
                <img
                  src={props.settings?.logo_data_url ?? ''}
                  alt="logo"
                  class="max-w-full max-h-full object-contain"
                />
              </Show>
            </div>
            <div class="text-sm leading-5">
              <div class="text-lg font-bold">
                {props.settings?.company_name ?? (
                  <span class="text-base-content/40 font-normal italic">
                    {t('your_company_name')}
                  </span>
                )}
              </div>
              <SenderLine value={props.settings?.address_line1} />
              <SenderLine value={props.settings?.address_line2} />
              <SenderLine
                value={[props.settings?.postal_code, props.settings?.city]
                  .filter(Boolean)
                  .join(' ')}
              />
              <SenderLine value={props.settings?.country} />
              <SenderLine value={props.settings?.email} />
              <SenderLine
                value={
                  props.settings?.vat_number
                    ? `${t('vat_number')}: ${props.settings.vat_number}`
                    : null
                }
              />
            </div>
          </div>

          <div class="text-right">
            <div class="text-3xl font-bold tracking-tight">INVOICE</div>
            <div class="mt-2">
              <input
                class="input input-ghost input-sm text-right text-sm w-44 focus:outline-success"
                value={props.form.invoice_number}
                placeholder={t('invoice_number_placeholder')}
                onInput={(e) =>
                  props.setForm('invoice_number', e.currentTarget.value)
                }
              />
            </div>
          </div>
        </div>

        <div class="border-t border-base-300" />

        {/* Meta + Bill To */}
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <div class="text-xs uppercase tracking-wider text-base-content/50 font-semibold mb-2">
              {t('invoice_details')}
            </div>
            <div class="grid grid-cols-2 gap-y-2 text-sm items-center">
              <span class="text-base-content/60">{t('issue_date')}</span>
              <input
                type="date"
                class="input input-bordered input-sm w-full"
                value={props.form.issue_date}
                onInput={(e) =>
                  props.setForm('issue_date', e.currentTarget.value)
                }
              />
              <span class="text-base-content/60">{t('due_date')}</span>
              <input
                type="date"
                class="input input-bordered input-sm w-full"
                value={props.form.due_date}
                onInput={(e) =>
                  props.setForm('due_date', e.currentTarget.value)
                }
              />
              <span class="text-base-content/60">{t('status')}</span>
              <select
                class="select select-bordered select-sm w-full"
                value={props.form.status}
                onChange={(e) =>
                  props.setForm(
                    'status',
                    e.currentTarget.value as InvoiceStatus
                  )
                }
              >
                <option value="draft">{t('invoice_status_draft')}</option>
                <option value="sent">{t('invoice_status_sent')}</option>
                <option value="paid">{t('invoice_status_paid')}</option>
              </select>
              <span class="text-base-content/60">{t('currency')}</span>
              <input
                class="input input-bordered input-sm w-full"
                value={props.form.currency}
                onInput={(e) =>
                  props.setForm('currency', e.currentTarget.value)
                }
              />
            </div>
          </div>

          <div>
            <div class="text-xs uppercase tracking-wider text-base-content/50 font-semibold mb-2">
              {t('bill_to')}
            </div>
            <select
              class="select select-bordered w-full mb-3"
              value={props.form.organization_id ?? ''}
              onChange={(e) =>
                props.onOrgChange(
                  e.currentTarget.value === ''
                    ? null
                    : Number(e.currentTarget.value)
                )
              }
            >
              <option value="">{t('select_klant')}</option>
              <For each={props.organizations}>
                {(org) => <option value={org.id}>{org.name}</option>}
              </For>
            </select>
            <Show
              when={props.selectedOrg}
              fallback={
                <div class="text-sm text-base-content/40 italic">
                  {t('no_klant_selected')}
                </div>
              }
            >
              <RecipientBlock org={props.selectedOrg!} />
            </Show>
          </div>
        </div>

        {/* Lines */}
        <div>
          <div class="text-xs uppercase tracking-wider text-base-content/50 font-semibold mb-2">
            {t('invoice_lines')}
          </div>
          <div class="overflow-x-auto rounded-lg border border-base-300">
            <table class="table table-sm">
              <thead class="bg-base-200">
                <tr>
                  <th class="w-1/2">{t('description')}</th>
                  <th class="text-right">{t('quantity')}</th>
                  <th class="text-right">{t('unit_price')}</th>
                  <th class="text-right">{t('vat_rate_short')}</th>
                  <th class="text-right">{t('line_total')}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                <For each={props.form.lines}>
                  {(line, index) => {
                    const qty = () => parseFloat(line.quantity || '0') || 0
                    const price = () => parseFloat(line.unit_price || '0') || 0
                    const lineTotal = () => qty() * price()
                    return (
                      <tr>
                        <td>
                          <input
                            class="input input-ghost input-sm w-full"
                            value={line.description}
                            placeholder={t('line_description_placeholder')}
                            onInput={(e) =>
                              props.onLineUpdate(
                                index(),
                                'description',
                                e.currentTarget.value
                              )
                            }
                          />
                        </td>
                        <td>
                          <input
                            class="input input-ghost input-sm w-20 text-right"
                            type="number"
                            step="0.001"
                            value={line.quantity}
                            onInput={(e) =>
                              props.onLineUpdate(
                                index(),
                                'quantity',
                                e.currentTarget.value
                              )
                            }
                          />
                        </td>
                        <td>
                          <input
                            class="input input-ghost input-sm w-28 text-right"
                            type="number"
                            step="0.01"
                            value={line.unit_price}
                            onInput={(e) =>
                              props.onLineUpdate(
                                index(),
                                'unit_price',
                                e.currentTarget.value
                              )
                            }
                          />
                        </td>
                        <td>
                          <div class="flex items-center justify-end gap-1">
                            <input
                              class="input input-ghost input-sm w-16 text-right"
                              type="number"
                              step="0.01"
                              value={line.vat_rate}
                              onInput={(e) =>
                                props.onLineUpdate(
                                  index(),
                                  'vat_rate',
                                  e.currentTarget.value
                                )
                              }
                            />
                            <span class="text-base-content/50 text-sm">%</span>
                          </div>
                        </td>
                        <td class="text-right font-medium tabular-nums">
                          {formatMoney(lineTotal(), props.form.currency)}
                        </td>
                        <td class="text-right">
                          <IconButton
                            icon="fa-solid fa-trash"
                            size="sm"
                            color="error"
                            onClick={() => props.onLineRemove(index())}
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
              onClick={props.onAddLine}
            />
          </div>
        </div>

        {/* Totals */}
        <div class="flex justify-end">
          <div class="w-full md:w-80 text-sm">
            <div class="flex items-center justify-between py-1">
              <span class="text-base-content/60">{t('subtotal')}</span>
              <span class="tabular-nums">
                {formatMoney(props.subtotal, props.form.currency)}
              </span>
            </div>
            <For each={props.breakdown}>
              {(bucket) => (
                <div class="flex items-center justify-between py-1">
                  <span class="text-base-content/60">
                    {t('vat')} ({bucket.rate}%)
                  </span>
                  <span class="tabular-nums">
                    {formatMoney(bucket.vat, props.form.currency)}
                  </span>
                </div>
              )}
            </For>
            <div class="border-t border-base-300 my-1" />
            <div class="flex items-center justify-between py-1 text-base font-bold">
              <span>{t('total')}</span>
              <span class="tabular-nums text-success">
                {formatMoney(props.total, props.form.currency)}
              </span>
            </div>
          </div>
        </div>

        {/* Notes */}
        <div>
          <div class="text-xs uppercase tracking-wider text-base-content/50 font-semibold mb-2">
            {t('notes')}
          </div>
          <textarea
            class="textarea textarea-bordered w-full"
            rows="2"
            placeholder={t('notes_placeholder')}
            value={props.form.notes}
            onInput={(e) => props.setForm('notes', e.currentTarget.value)}
          />
        </div>

        <Show when={props.settings?.iban || props.settings?.footer_text}>
          <div class="border-t border-base-300 pt-4 text-xs text-base-content/60">
            <Show when={props.settings?.iban}>
              <div>
                {t('payment_iban_label')}: {props.settings?.iban}
              </div>
            </Show>
            <Show when={props.settings?.footer_text}>
              <div class="whitespace-pre-line">
                {props.settings?.footer_text}
              </div>
            </Show>
          </div>
        </Show>

        <div class="text-xs text-base-content/40">
          {t('issued_on')} {formatDate(props.form.issue_date)}
        </div>
      </div>
    </div>
  )
}

function SenderLine(props: { value: string | null | undefined }): JSXElement {
  return (
    <Show when={props.value}>
      <div class="text-base-content/70">{props.value}</div>
    </Show>
  )
}

function RecipientBlock(props: { org: OrganizationAttributes }): JSXElement {
  const { t } = useLocale()
  return (
    <div class="text-sm leading-5">
      <div class="font-semibold">{props.org.name}</div>
      <Show when={props.org.address_line1}>
        <div class="text-base-content/70">{props.org.address_line1}</div>
      </Show>
      <Show when={props.org.address_line2}>
        <div class="text-base-content/70">{props.org.address_line2}</div>
      </Show>
      <Show when={props.org.postal_code || props.org.city}>
        <div class="text-base-content/70">
          {[props.org.postal_code, props.org.city].filter(Boolean).join(' ')}
        </div>
      </Show>
      <Show when={props.org.country}>
        <div class="text-base-content/70">{props.org.country}</div>
      </Show>
      <Show when={props.org.email}>
        <div class="text-base-content/70">{props.org.email}</div>
      </Show>
      <Show when={props.org.vat_number}>
        <div class="text-base-content/70">
          {t('vat_number')}: {props.org.vat_number}
        </div>
      </Show>
    </div>
  )
}
