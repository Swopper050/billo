import { BaseModelAttributes } from './Base'

export interface CompanySettingsAttributes {
  id: number
  workspace_id: number
  company_name: string | null
  email: string | null
  phone: string | null
  website: string | null
  vat_number: string | null
  kvk_number: string | null
  iban: string | null
  address_line1: string | null
  address_line2: string | null
  postal_code: string | null
  city: string | null
  country: string | null
  default_vat_rate: string
  invoice_prefix: string | null
  next_invoice_number: number
  footer_text: string | null
  logo_data_url: string | null
}

export type CompanySettingsInput = Omit<
  CompanySettingsAttributes,
  'id' | 'workspace_id'
>

export interface InvoiceLineAttributes {
  id: number | null
  position: number
  description: string
  quantity: string
  unit_price: string
  vat_rate: string
  line_total: string
  line_vat: string
}

export interface InvoiceLineInput {
  description: string
  quantity: string
  unit_price: string
  vat_rate: string
}

export interface VatBreakdownEntry {
  rate: string
  net: string
  vat: string
}

export type InvoiceStatus = 'draft' | 'sent' | 'paid'

export interface InvoiceAttributes extends BaseModelAttributes {
  id: number
  workspace_id: number
  organization_id: number | null
  invoice_number: string
  status: InvoiceStatus
  issue_date: string
  due_date: string | null
  currency: string
  vat_rate: string

  recipient_name: string
  recipient_email: string | null
  recipient_address_line1: string | null
  recipient_address_line2: string | null
  recipient_postal_code: string | null
  recipient_city: string | null
  recipient_country: string | null
  recipient_vat_number: string | null
  recipient_kvk_number: string | null

  sender_name: string | null
  sender_email: string | null
  sender_phone: string | null
  sender_website: string | null
  sender_vat_number: string | null
  sender_kvk_number: string | null
  sender_iban: string | null
  sender_address_line1: string | null
  sender_address_line2: string | null
  sender_postal_code: string | null
  sender_city: string | null
  sender_country: string | null
  sender_footer_text: string | null

  notes: string | null
  created_at: string
  updated_at: string

  lines: InvoiceLineAttributes[]
  subtotal: string
  vat_amount: string
  total: string
  vat_breakdown: VatBreakdownEntry[]
}

export interface InvoiceListItemAttributes {
  id: number
  invoice_number: string
  status: InvoiceStatus
  issue_date: string
  due_date: string | null
  currency: string
  recipient_name: string
  organization_id: number | null
  total: string
  created_at: string
}

export interface InvoiceInput {
  organization_id: number | null
  invoice_number?: string | null
  status?: InvoiceStatus | null
  issue_date?: string | null
  due_date?: string | null
  currency?: string | null
  vat_rate?: string | null
  notes?: string | null
  lines: InvoiceLineInput[]
  recipient_name?: string | null
  recipient_email?: string | null
  recipient_address_line1?: string | null
  recipient_address_line2?: string | null
  recipient_postal_code?: string | null
  recipient_city?: string | null
  recipient_country?: string | null
  recipient_vat_number?: string | null
  recipient_kvk_number?: string | null
}
