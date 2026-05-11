import {
  createMemo,
  createResource,
  createSignal,
  For,
  JSXElement,
  Show,
} from 'solid-js'
import { useSearchParams } from '@solidjs/router'

import {
  createOrganization,
  createPerson,
  deleteOrganization,
  deletePerson,
  listOrganizations,
  listPeople,
  updateOrganization,
  updatePerson,
} from '../../api'
import { Button, IconButton } from '../../components/Button'
import { useLocale } from '../../context/LocaleProvider'
import { useWorkspace } from '../../context/WorkspaceProvider'
import {
  OrganizationAttributes,
  OrganizationInput,
  PersonAttributes,
  PersonInput,
} from '../../models/Contacts'
import { OrganizationFormModal } from './OrganizationFormModal'
import { PersonFormModal } from './PersonFormModal'

type ContactsTab = 'klanten' | 'people'

export function ContactsPage(): JSXElement {
  const { t } = useLocale()
  const { currentWorkspace } = useWorkspace()
  const [searchParams, setSearchParams] = useSearchParams()

  const workspaceId = () => currentWorkspace()?.id ?? 0

  const initialTab: ContactsTab =
    searchParams.tab === 'people' ? 'people' : 'klanten'
  const [tab, setTab] = createSignal<ContactsTab>(initialTab)

  const setActiveTab = (newTab: ContactsTab) => {
    setTab(newTab)
    setSearchParams({ tab: newTab })
  }

  const [organizations, { refetch: refetchOrgs }] = createResource(
    workspaceId,
    async (id) => {
      if (!id) return []
      return await listOrganizations(id)
    }
  )

  const [people, { refetch: refetchPeople }] = createResource(
    workspaceId,
    async (id) => {
      if (!id) return []
      return await listPeople(id)
    }
  )

  const [editingOrg, setEditingOrg] =
    createSignal<OrganizationAttributes | null>(null)
  const [orgModalOpen, setOrgModalOpen] = createSignal(false)
  const [editingPerson, setEditingPerson] =
    createSignal<PersonAttributes | null>(null)
  const [personModalOpen, setPersonModalOpen] = createSignal(false)

  const openCreateOrg = () => {
    setEditingOrg(null)
    setOrgModalOpen(true)
  }
  const openEditOrg = (org: OrganizationAttributes) => {
    setEditingOrg(org)
    setOrgModalOpen(true)
  }
  const openCreatePerson = () => {
    setEditingPerson(null)
    setPersonModalOpen(true)
  }
  const openEditPerson = (person: PersonAttributes) => {
    setEditingPerson(person)
    setPersonModalOpen(true)
  }

  const handleSaveOrg = async (input: OrganizationInput) => {
    const id = workspaceId()
    if (!id) return
    const editing = editingOrg()
    if (editing) {
      await updateOrganization(id, editing.id, input)
    } else {
      await createOrganization(id, input)
    }
    setOrgModalOpen(false)
    await refetchOrgs()
  }

  const handleDeleteOrg = async (org: OrganizationAttributes) => {
    if (!confirm(t('confirm_delete_organization'))) return
    const id = workspaceId()
    if (!id) return
    await deleteOrganization(id, org.id)
    await Promise.all([refetchOrgs(), refetchPeople()])
  }

  const handleSavePerson = async (input: PersonInput) => {
    const id = workspaceId()
    if (!id) return
    const editing = editingPerson()
    if (editing) {
      await updatePerson(id, editing.id, input)
    } else {
      await createPerson(id, input)
    }
    setPersonModalOpen(false)
    await refetchPeople()
  }

  const handleDeletePerson = async (person: PersonAttributes) => {
    if (!confirm(t('confirm_delete_person'))) return
    const id = workspaceId()
    if (!id) return
    await deletePerson(id, person.id)
    await refetchPeople()
  }

  const orgsList = createMemo(() => organizations() ?? [])
  const peopleList = createMemo(() => people() ?? [])

  return (
    <div class="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
      <div class="max-w-5xl mx-auto">
        <div class="mb-6 flex items-end justify-between gap-4">
          <div>
            <h1 class="text-2xl font-bold">{t('contacts')}</h1>
            <p class="text-base-content/60 text-sm mt-1">
              {t('contacts_subtitle')}
            </p>
          </div>
          <Show when={tab() === 'klanten'}>
            <Button
              color="primary"
              icon="fa-solid fa-plus"
              label={t('add_klant')}
              onClick={openCreateOrg}
            />
          </Show>
          <Show when={tab() === 'people'}>
            <Button
              color="primary"
              icon="fa-solid fa-plus"
              label={t('add_person')}
              onClick={openCreatePerson}
            />
          </Show>
        </div>

        <div role="tablist" class="tabs tabs-bordered mb-4">
          <a
            role="tab"
            classList={{ tab: true, 'tab-active': tab() === 'klanten' }}
            onClick={() => setActiveTab('klanten')}
          >
            <i class="fa-solid fa-building mr-2" />
            {t('klanten')}
          </a>
          <a
            role="tab"
            classList={{ tab: true, 'tab-active': tab() === 'people' }}
            onClick={() => setActiveTab('people')}
          >
            <i class="fa-solid fa-users mr-2" />
            {t('people')}
          </a>
        </div>

        <Show when={tab() === 'klanten'}>
          <Show
            when={orgsList().length > 0}
            fallback={
              <EmptyState
                icon="fa-solid fa-building"
                title={t('no_klanten_yet')}
                description={t('no_klanten_yet_description')}
                actionLabel={t('add_klant')}
                onAction={openCreateOrg}
              />
            }
          >
            <div class="overflow-x-auto border border-base-300 rounded-2xl">
              <table class="table">
                <thead>
                  <tr>
                    <th>{t('name')}</th>
                    <th>{t('email')}</th>
                    <th>{t('city')}</th>
                    <th>{t('vat_number')}</th>
                    <th class="text-end">{t('actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  <For each={orgsList()}>
                    {(org) => (
                      <tr class="hover">
                        <td>
                          <button
                            class="font-semibold link link-hover text-left"
                            onClick={() => openEditOrg(org)}
                          >
                            {org.name}
                          </button>
                          <Show when={org.kvk_number}>
                            <div class="text-xs text-base-content/60">
                              KvK {org.kvk_number}
                            </div>
                          </Show>
                        </td>
                        <td class="text-sm">{org.email ?? '—'}</td>
                        <td class="text-sm">
                          {[org.postal_code, org.city]
                            .filter(Boolean)
                            .join(' ') || '—'}
                        </td>
                        <td class="text-sm">{org.vat_number ?? '—'}</td>
                        <td class="text-end">
                          <IconButton
                            icon="fa-solid fa-pen"
                            size="sm"
                            onClick={() => openEditOrg(org)}
                          />
                          <IconButton
                            icon="fa-solid fa-trash"
                            size="sm"
                            color="error"
                            onClick={() => handleDeleteOrg(org)}
                          />
                        </td>
                      </tr>
                    )}
                  </For>
                </tbody>
              </table>
            </div>
          </Show>
        </Show>

        <Show when={tab() === 'people'}>
          <Show
            when={peopleList().length > 0}
            fallback={
              <EmptyState
                icon="fa-solid fa-users"
                title={t('no_people_yet')}
                description={t('no_people_yet_description')}
                actionLabel={t('add_person')}
                onAction={openCreatePerson}
              />
            }
          >
            <div class="overflow-x-auto border border-base-300 rounded-2xl">
              <table class="table">
                <thead>
                  <tr>
                    <th>{t('name')}</th>
                    <th>{t('organization')}</th>
                    <th>{t('email')}</th>
                    <th>{t('phone')}</th>
                    <th class="text-end">{t('actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  <For each={peopleList()}>
                    {(person) => (
                      <tr class="hover">
                        <td>
                          <button
                            class="font-semibold link link-hover text-left"
                            onClick={() => openEditPerson(person)}
                          >
                            {[person.first_name, person.last_name]
                              .filter(Boolean)
                              .join(' ')}
                          </button>
                          <Show when={person.role}>
                            <div class="text-xs text-base-content/60">
                              {person.role}
                            </div>
                          </Show>
                        </td>
                        <td class="text-sm">
                          {person.organization_name ?? '—'}
                        </td>
                        <td class="text-sm">{person.email ?? '—'}</td>
                        <td class="text-sm">{person.phone ?? '—'}</td>
                        <td class="text-end">
                          <IconButton
                            icon="fa-solid fa-pen"
                            size="sm"
                            onClick={() => openEditPerson(person)}
                          />
                          <IconButton
                            icon="fa-solid fa-trash"
                            size="sm"
                            color="error"
                            onClick={() => handleDeletePerson(person)}
                          />
                        </td>
                      </tr>
                    )}
                  </For>
                </tbody>
              </table>
            </div>
          </Show>
        </Show>
      </div>

      <OrganizationFormModal
        isOpen={orgModalOpen()}
        organization={editingOrg()}
        onClose={() => setOrgModalOpen(false)}
        onSave={handleSaveOrg}
      />
      <PersonFormModal
        isOpen={personModalOpen()}
        person={editingPerson()}
        organizations={orgsList()}
        onClose={() => setPersonModalOpen(false)}
        onSave={handleSavePerson}
      />
    </div>
  )
}

function EmptyState(props: {
  icon: string
  title: string
  description: string
  actionLabel: string
  onAction: () => void
}): JSXElement {
  return (
    <div class="flex flex-col items-center justify-center text-center py-16 px-4 border border-base-300 border-dashed rounded-2xl">
      <i class={`${props.icon} text-3xl text-base-content/40 mb-3`} />
      <h3 class="text-lg font-semibold">{props.title}</h3>
      <p class="text-sm text-base-content/60 max-w-md mt-1">
        {props.description}
      </p>
      <Button
        class="mt-4"
        color="primary"
        icon="fa-solid fa-plus"
        label={props.actionLabel}
        onClick={props.onAction}
      />
    </div>
  )
}
