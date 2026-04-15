import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
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
          path="/campaigns/:campaignId/sessions"
          element={
            <RequireAuth>
              <SessionsPage />
            </RequireAuth>
          }
        />
        <Route
          path="/campaigns/:campaignId/sessions/:sessionId"
          element={
            <RequireAuth>
              <SessionDetailPage />
            </RequireAuth>
          }
        />
        <Route
          path="/campaigns/:campaignId/storylines"
          element={
            <RequireAuth>
              <StorylinesPage />
            </RequireAuth>
          }
        />
        <Route
          path="/campaigns/:campaignId/storylines/:storylineId"
          element={
            <RequireAuth>
              <StorylineDetailPage />
            </RequireAuth>
          }
        />
        <Route
          path="/campaigns/:campaignId/characters"
          element={
            <RequireAuth>
              <CharactersPage />
            </RequireAuth>
          }
        />
        <Route
          path="/campaigns/:campaignId/wiki"
          element={
            <RequireAuth>
              <WikiListPage />
            </RequireAuth>
          }
        />
        <Route
          path="/campaigns/:campaignId/wiki/new"
          element={
            <RequireAuth>
              <WikiEditorPage />
            </RequireAuth>
          }
        />
        <Route
          path="/campaigns/:campaignId/wiki/:articleId/edit"
          element={
            <RequireAuth>
              <WikiEditorPage />
            </RequireAuth>
          }
        />
        <Route
          path="/campaigns/:campaignId/wiki/:articleId"
          element={
            <RequireAuth>
              <WikiArticlePage />
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
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  )
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AppLayout />
      </BrowserRouter>
    </QueryClientProvider>
  )
}
