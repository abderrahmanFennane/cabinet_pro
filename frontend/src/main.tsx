import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'sonner'
import App from './App'
import { AuthProvider } from './providers/AuthProvider'
import './i18n'
import './index.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Data stays fresh for a minute: moving between pages or reopening a dialog shows it instantly.
      // Mutations invalidate what they change; live screens (today, waiting room) poll on their own.
      staleTime: 60_000,
      gcTime: 15 * 60_000,
      refetchOnWindowFocus: true,
      retry: 1,
    },
  },
})

// Reference lists behind select boxes change rarely (and their edit screens invalidate them): keep them 5 minutes.
for (const key of ['team', 'acts', 'plans', 'specialties', 'app-settings', 'cabinet']) {
  queryClient.setQueryDefaults([key], { staleTime: 5 * 60_000 })
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <App />
          <Toaster
            position="top-right"
            toastOptions={{
              duration: 1000,
              classNames: {
                toast:
                  'bg-background text-foreground border border-border rounded-lg shadow-lg',
                success: 'border-primary',
                error: 'border-destructive',
              },
            }}
          />
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>,
)
