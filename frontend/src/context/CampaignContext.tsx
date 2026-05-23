import { createContext, useContext, useState } from 'react'

export type CampaignRole = 'owner' | 'game_master' | 'player' | null

interface CampaignContextValue {
  campaignId: string | null
  setCampaignId: (id: string | null) => void
  campaignRole: CampaignRole
  setCampaignRole: (role: CampaignRole) => void
}

const CampaignContext = createContext<CampaignContextValue>({
  campaignId: null,
  setCampaignId: () => {},
  campaignRole: null,
  setCampaignRole: () => {},
})

export function CampaignProvider({ children }: { children: React.ReactNode }) {
  const [campaignId, setCampaignIdState] = useState<string | null>(
    () => sessionStorage.getItem('activeCampaignId'),
  )
  const [campaignRole, setCampaignRoleState] = useState<CampaignRole>(
    () => (sessionStorage.getItem('activeCampaignRole') as CampaignRole) ?? null,
  )

  function setCampaignId(id: string | null) {
    if (id) sessionStorage.setItem('activeCampaignId', id)
    else sessionStorage.removeItem('activeCampaignId')
    setCampaignIdState(id)
  }

  function setCampaignRole(role: CampaignRole) {
    if (role) sessionStorage.setItem('activeCampaignRole', role)
    else sessionStorage.removeItem('activeCampaignRole')
    setCampaignRoleState(role)
  }

  return (
    <CampaignContext.Provider value={{ campaignId, setCampaignId, campaignRole, setCampaignRole }}>
      {children}
    </CampaignContext.Provider>
  )
}

export function useCampaignId(): string {
  const { campaignId } = useContext(CampaignContext)
  if (!campaignId) throw new Error('useCampaignId called outside campaign context')
  return campaignId
}

export function useCampaignRole(): CampaignRole {
  return useContext(CampaignContext).campaignRole
}

export function useSetCampaignId() {
  return useContext(CampaignContext).setCampaignId
}

export function useSetCampaignRole() {
  return useContext(CampaignContext).setCampaignRole
}

export function useCampaignIdMaybe(): string | null {
  return useContext(CampaignContext).campaignId
}
