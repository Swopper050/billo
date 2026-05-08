import {
  createMemo,
  createResource,
  createSignal,
  For,
  JSXElement,
  Show,
} from 'solid-js'
import { A, useNavigate } from '@solidjs/router'

import {
  deleteInvoice,
  getCustomerInvoicePdfUrl,
  listInvoices,
} from '../../api'
import { Button, IconButton } from '../../components/Button'
import { useLocale } from '../../context/LocaleProvider'
import { useWorkspace } from '../../context/WorkspaceProvider'
import { InvoiceListItemAttributes } from '../../models/Invoicing'

function formatDate(value: string | null): string {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  return d.toLocaleDateString()
}

function formatMoney(amount: string, currency: string): string {
  const value = Number(amount)
  if (Number.isNaN(value)) return `${currency} ${amount}`
  return `${currency} ${value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

function statusBadgeClass(status: string): string {
  switch (status) {
    case 'paid':
      return 'badge badge-success'
    case 'sent':
      return 'badge badge-info'
    default:
      return 'badge'
  }
}

export function InvoicesPage(): JSXElement {
  const { t } = useLocale()
  const { currentWorkspace } = useWorkspace()
  const navigate = useNavigate()
  const workspaceId = () => currentWorkspace()?.id ?? 0

  const [invoices, { refetch }] = createResource(workspaceId, async (id) => {
    if (!id) return []
    return await listInvoices(id)
  })

  const [downloadingId, setDownloadingId] = createSignal<number | null>(null)

  const handleDelete = async (invoice: InvoiceListItemAttributes) => {
    if (!confirm(t('confirm_delete_invoice'))) return
    const id = workspaceId()
    if (!id) return
    await deleteInvoice(id, invoice.id)
    await refetch()
  }

  const handleDownload = async (invoice: InvoiceListItemAttributes) => {
    const id = workspaceId()
    if (!id) return
    setDownloadingId(invoice.id)
    try {
      const url = getCustomerInvoicePdfUrl(id, invoice.id)
      const response = await fetch(url, { credentials: 'include' })
      if (!response.ok) {
        alert(t('an_unknown_error_occurred'))
        return
      }
      const blob = await response.blob()
      const objectUrl = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = objectUrl
      a.download = `invoice-${invoice.invoice_number || invoice.id}.pdf`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(objectUrl)
    } finally {
      setDownloadingId(null)
    }
  }

  const list = createMemo(() => invoices() ?? [])

  return (
    <div class="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
      <div class="max-w-5xl mx-auto">
        <div class="mb-6 flex items-end justify-between gap-4">
          <div>
            <h1 class="text-2xl font-bold">{t('invoices')}</h1>
            <p class="text-base-content/60 text-sm mt-1">
              {t('invoices_subtitle')}
            </p>
          </div>
          <div class="flex gap-2">
            <Button
              color="primary"
              icon="fa-solid fa-plus"
              label={t('new_invoice')}
              onClick={() => navigate('/invoices/new')}
            />
          </div>
        </div>

        <Show
          when={list().length > 0}
          fallback={
            <div class="flex flex-col items-center justify-center text-center py-16 px-4 border border-base-300 border-dashed rounded-2xl">
              <i class="fa-solid fa-file-invoice text-3xl text-base-content/40 mb-3" />
              <h3 class="text-lg font-semibold">{t('no_invoices_yet')}</h3>
              <p class="text-sm text-base-content/60 max-w-md mt-1">
                {t('no_invoices_yet_description')}
              </p>
              <Button
                class="mt-4"
                color="primary"
                icon="fa-solid fa-plus"
                label={t('new_invoice')}
                onClick={() => navigate('/invoices/new')}
              />
            </div>
          }
        >
          <div class="overflow-x-auto border border-base-300 rounded-2xl">
            <table class="table">
              <thead>
                <tr>
                  <th>{t('invoice_number')}</th>
                  <th>{t('recipient')}</th>
                  <th>{t('issue_date')}</th>
                  <th>{t('due_date')}</th>
                  <th>{t('status')}</th>
                  <th class="text-end">{t('total')}</th>
                  <th class="text-end">{t('actions')}</th>
                </tr>
              </thead>
              <tbody>
                <For each={list()}>
                  {(invoice) => (
                    <tr class="hover">
                      <td>
                        <A
                          class="font-semibold link link-hover"
                          href={`/invoices/${invoice.id}`}
                        >
                          {invoice.invoice_number}
                        </A>
                      </td>
                      <td class="text-sm">{invoice.recipient_name}</td>
                      <td class="text-sm">{formatDate(invoice.issue_date)}</td>
                      <td class="text-sm">{formatDate(invoice.due_date)}</td>
                      <td>
                        <span class={statusBadgeClass(invoice.status)}>
                          {invoice.status === 'paid'
                            ? t('invoice_status_paid')
                            : invoice.status === 'sent'
                              ? t('invoice_status_sent')
                              : t('invoice_status_draft')}
                        </span>
                      </td>
                      <td class="text-end font-semibold">
                        {formatMoney(invoice.total, invoice.currency)}
                      </td>
                      <td class="text-end whitespace-nowrap">
                        <IconButton
                          icon="fa-solid fa-download"
                          size="sm"
                          isLoading={downloadingId() === invoice.id}
                          onClick={() => handleDownload(invoice)}
                        />
                        <A
                          href={`/invoices/${invoice.id}`}
                          class="btn btn-ghost btn-sm btn-square"
                          aria-label={t('edit')}
                        >
                          <i class="fa-solid fa-pen" />
                        </A>
                        <IconButton
                          icon="fa-solid fa-trash"
                          size="sm"
                          color="error"
                          onClick={() => handleDelete(invoice)}
                        />
                      </td>
                    </tr>
                  )}
                </For>
              </tbody>
            </table>
          </div>
        </Show>
      </div>
    </div>
  )
}
