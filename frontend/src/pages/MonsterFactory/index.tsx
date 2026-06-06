import { useState } from 'react'
import { useCampaignIdMaybe } from '../../context/CampaignContext'
import { useGMProfiles, useDefaultGMProfile } from '../../hooks/useMonsterFactory'
import { GMProfileModal } from '../../components/MonsterFactory/GMProfileModal'
import { EncounterWizard } from '../../components/MonsterFactory/EncounterWizard'
import { SavedEncountersList } from '../../components/MonsterFactory/SavedEncountersList'
import { MonsterTemplatesList } from '../../components/MonsterFactory/MonsterTemplatesList'
import './MonsterFactory.css'
import '../../components/MonsterFactory/SavedTab.css'

type Tab = 'create' | 'saved'
type SavedSubTab = 'encounters' | 'templates'

function SavedEncountersTabContent({ onSwitchToCreate }: { onSwitchToCreate: () => void }) {
  const [subTab, setSubTab] = useState<SavedSubTab>('encounters')
  return (
    <div>
      <div className="st-subtabs" role="tablist">
        <button
          role="tab"
          aria-selected={subTab === 'encounters'}
          className={`st-subtab-btn${subTab === 'encounters' ? ' st-subtab-btn--active' : ''}`}
          onClick={() => setSubTab('encounters')}
        >
          Saved Encounters
        </button>
        <button
          role="tab"
          aria-selected={subTab === 'templates'}
          className={`st-subtab-btn${subTab === 'templates' ? ' st-subtab-btn--active' : ''}`}
          onClick={() => setSubTab('templates')}
        >
          Monster Templates
        </button>
      </div>
      {subTab === 'encounters' && (
        <SavedEncountersList onSwitchToCreate={onSwitchToCreate} />
      )}
      {subTab === 'templates' && <MonsterTemplatesList />}
    </div>
  )
}

export function MonsterFactoryPage() {
  const campaignId = useCampaignIdMaybe()
  const { data: profiles = [], isLoading: profilesLoading } = useGMProfiles()
  const { data: defaultProfile } = useDefaultGMProfile()

  const [activeTab, setActiveTab] = useState<Tab>('create')
  const [selectedProfileId, setSelectedProfileId] = useState<string>('')
  const [profileModalOpen, setProfileModalOpen] = useState(false)

  // Sync selected profile to default once loaded
  const resolvedProfileId = selectedProfileId || defaultProfile?.id || ''

  return (
    <div className="mf-page">
      {/* ── Header ── */}
      <div className="mf-header">
        <h1 className="mf-title">Monster Factory</h1>

        <div className="mf-profile-controls">
          <span className="mf-profile-label">GM Profile:</span>
          <select
            className="mf-profile-select"
            value={resolvedProfileId}
            onChange={(e) => setSelectedProfileId(e.target.value)}
            disabled={profilesLoading}
            aria-label="Select GM profile"
          >
            {profilesLoading && <option value="">Loading…</option>}
            {profiles.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}{p.is_default ? ' (default)' : ''}
              </option>
            ))}
          </select>

          <button
            type="button"
            className="mf-manage-link"
            onClick={() => setProfileModalOpen(true)}
            style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
          >
            Manage Profiles
          </button>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className="mf-tabs" role="tablist">
        <button
          role="tab"
          aria-selected={activeTab === 'create'}
          className={`mf-tab-btn${activeTab === 'create' ? ' mf-tab-btn--active' : ''}`}
          onClick={() => setActiveTab('create')}
        >
          Create Encounter
        </button>
        <button
          role="tab"
          aria-selected={activeTab === 'saved'}
          className={`mf-tab-btn${activeTab === 'saved' ? ' mf-tab-btn--active' : ''}`}
          onClick={() => setActiveTab('saved')}
        >
          Saved Encounters
        </button>
      </div>

      {/* ── Tab panels — always mounted, hidden via display:none to preserve wizard state ── */}
      <div className="mf-tab-content">
        <div
          role="tabpanel"
          aria-label="Create Encounter"
          style={{ display: activeTab === 'create' ? undefined : 'none' }}
        >
          <EncounterWizard
            gmProfileId={resolvedProfileId}
            campaignId={campaignId ?? undefined}
            onSwitchToSaved={() => setActiveTab('saved')}
          />
        </div>
        <div
          role="tabpanel"
          aria-label="Saved Encounters"
          style={{ display: activeTab === 'saved' ? undefined : 'none' }}
        >
          <SavedEncountersTabContent onSwitchToCreate={() => setActiveTab('create')} />
        </div>
      </div>

      {/* ── GM Profile modal ── */}
      <GMProfileModal
        isOpen={profileModalOpen}
        onClose={() => setProfileModalOpen(false)}
        onProfileChange={(id) => setSelectedProfileId(id)}
      />
    </div>
  )
}
