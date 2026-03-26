import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { LoginPage } from './pages/LoginPage'
import { SessionDetailPage } from './pages/SessionDetailPage'
import { SessionsPage } from './pages/SessionsPage'
import { CharactersPage } from './pages/CharactersPage'
import { RollHistoryPage } from './pages/RollHistoryPage'
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
              <SessionsPage />
            </RequireAuth>
          }
        />
        <Route
          path="/sessions/:id"
          element={
            <RequireAuth>
              <SessionDetailPage />
            </RequireAuth>
          }
        />
        <Route
          path="/characters"
          element={
            <RequireAuth>
              <CharactersPage />
            </RequireAuth>
          }
        />
        <Route
          path="/characters/:id"
          element={
            <RequireAuth>
              <CharactersPage />
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
