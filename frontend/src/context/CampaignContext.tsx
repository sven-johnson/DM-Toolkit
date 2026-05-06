import { createContext, useContext, useState } from 'react'

interface CampaignContextValue {
  campaignId: string | null
  setCampaignId: (id: string | null) => void
}

const CampaignContext = createContext<CampaignContextValue>({
  campaignId: null,
  setCampaignId: () => {},
})

export function CampaignProvider({ children }: { children: React.ReactNode }) {
  const [campaignId, setCampaignIdState] = useState<string | null>(
    () => sessionStorage.getItem('activeCampaignId'),
  )

  function setCampaignId(id: string | null) {
    if (id) sessionStorage.setItem('activeCampaignId', id)
    else sessionStorage.removeItem('activeCampaignId')
    setCampaignIdState(id)
  }

  return (
    <CampaignContext.Provider value={{ campaignId, setCampaignId }}>
      {children}
    </CampaignContext.Provider>
  )
}

export function useCampaignId(): string {
  const { campaignId } = useContext(CampaignContext)
  if (!campaignId) throw new Error('useCampaignId called outside campaign context')
  return campaignId
}

export function useSetCampaignId() {
  return useContext(CampaignContext).setCampaignId
}

export function useCampaignIdMaybe(): string | null {
  return useContext(CampaignContext).campaignId
}
