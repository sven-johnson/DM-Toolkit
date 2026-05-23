import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { CampaignProvider, useCampaignIdMaybe, useCampaignRole } from './context/CampaignContext'
import { useCurrentUser } from './hooks/useCurrentUser'
import { ThemeProvider } from './context/ThemeContext'
import { LoginPage } from './pages/LoginPage'
import { CampaignsPage } from './pages/CampaignsPage'
import { SessionsPage } from './pages/SessionsPage'
import { SessionDetailPage } from './pages/SessionDetailPage'
import { StorylineDetailPage } from './pages/StorylineDetailPage'
import { StorylinesPage } from './pages/StorylinesPage'
import { CharactersPage } from './pages/CharactersPage'
import { RollHistoryPage } from './pages/RollHistoryPage'
import { WikiListPage } from './pages/WikiListPage'
import { WikiArticlePage } from './pages/WikiArticlePage'
import { WikiEditorPage } from './pages/WikiEditorPage'
import { UserSettingsPage } from './pages/UserSettingsPage'
import { DownloadPage } from './pages/DownloadPage'
import { Nav } from './components/Nav'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30_000 },
  },
})

function RequireAuth({ children }: { children: React.ReactNode }) {
  const token = localStorage.getItem('auth_token')
  if (!token) return <Navigate to="/login" replace />
  return <>{children}</>
}

function RequireCampaign({ children }: { children: React.ReactNode }) {
  const campaignId = useCampaignIdMaybe()
  if (!campaignId) return <Navigate to="/" replace />
  return <>{children}</>
}

function RequireGameMaster({ children }: { children: React.ReactNode }) {
  const campaignRole = useCampaignRole()
  const { data: currentUser } = useCurrentUser()
  const canAccess = currentUser?.is_admin || campaignRole === 'owner' || campaignRole === 'game_master'
  if (!canAccess) return <Navigate to="/wiki" replace />
  return <>{children}</>
}

function AppLayout() {
  const location = useLocation()
  const isLoginPage = location.pathname === '/login'

  return (
    <>
      {!isLoginPage && <Nav />}
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/"
          element={
            <RequireAuth>
              <CampaignsPage />
            </RequireAuth>
          }
        />
        <Route
          path="/sessions"
          element={
            <RequireAuth>
              <RequireCampaign>
                <RequireGameMaster>
                  <SessionsPage />
                </RequireGameMaster>
              </RequireCampaign>
            </RequireAuth>
          }
        />
        <Route
          path="/sessions/:sessionId"
          element={
            <RequireAuth>
              <RequireCampaign>
                <RequireGameMaster>
                  <SessionDetailPage />
                </RequireGameMaster>
              </RequireCampaign>
            </RequireAuth>
          }
        />
        <Route
          path="/storylines"
          element={
            <RequireAuth>
              <RequireCampaign>
                <RequireGameMaster>
                  <StorylinesPage />
                </RequireGameMaster>
              </RequireCampaign>
            </RequireAuth>
          }
        />
        <Route
          path="/storylines/:storylineId"
          element={
            <RequireAuth>
              <RequireCampaign>
                <RequireGameMaster>
                  <StorylineDetailPage />
                </RequireGameMaster>
              </RequireCampaign>
            </RequireAuth>
          }
        />
        <Route
          path="/characters"
          element={
            <RequireAuth>
              <RequireCampaign>
                <RequireGameMaster>
                  <CharactersPage />
                </RequireGameMaster>
              </RequireCampaign>
            </RequireAuth>
          }
        />
        <Route
          path="/wiki"
          element={
            <RequireAuth>
              <RequireCampaign>
                <WikiListPage />
              </RequireCampaign>
            </RequireAuth>
          }
        />
        <Route
          path="/wiki/new"
          element={
            <RequireAuth>
              <RequireCampaign>
                <RequireGameMaster>
                  <WikiEditorPage />
                </RequireGameMaster>
              </RequireCampaign>
            </RequireAuth>
          }
        />
        <Route
          path="/wiki/:articleId/edit"
          element={
            <RequireAuth>
              <RequireCampaign>
                <RequireGameMaster>
                  <WikiEditorPage />
                </RequireGameMaster>
              </RequireCampaign>
            </RequireAuth>
          }
        />
        <Route
          path="/wiki/:articleId"
          element={
            <RequireAuth>
              <RequireCampaign>
                <WikiArticlePage />
              </RequireCampaign>
            </RequireAuth>
          }
        />
        <Route
          path="/rolls"
          element={
            <RequireAuth>
              <RollHistoryPage />
            </RequireAuth>
          }
        />
        <Route
          path="/settings"
          element={
            <RequireAuth>
              <UserSettingsPage />
            </RequireAuth>
          }
        />
        <Route path="/download" element={<DownloadPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  )
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <ThemeProvider>
          <CampaignProvider>
            <AppLayout />
          </CampaignProvider>
        </ThemeProvider>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
