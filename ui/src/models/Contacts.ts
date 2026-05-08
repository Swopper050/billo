import { BaseModelAttributes } from './Base'

export interface OrganizationAttributes extends BaseModelAttributes {
  id: number
  workspace_id: number
  name: string
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
  notes: string | null
  created_at: string
  updated_at: string
  people_count: number
}

export interface PersonAttributes extends BaseModelAttributes {
  id: number
  workspace_id: number
  organization_id: number | null
  organization_name: string | null
  first_name: string
  last_name: string | null
  email: string | null
  phone: string | null
  role: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export type OrganizationInput = Omit<
  OrganizationAttributes,
  'id' | 'workspace_id' | 'created_at' | 'updated_at' | 'people_count'
>

export type PersonInput = Omit<
  PersonAttributes,
  'id' | 'workspace_id' | 'organization_name' | 'created_at' | 'updated_at'
>
