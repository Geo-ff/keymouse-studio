import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { MiniStatus } from './pages/MiniStatus'
import { AutomationProvider } from './providers/AutomationProvider'
import { ToastProvider } from './providers/ToastProvider'
import { isMiniView } from './utils/runtime'
import './styles.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ToastProvider>
      <AutomationProvider>
        {/* The desktop app loads index.html#mini into the always-on-top mini window. */}
        {isMiniView() ? <MiniStatus /> : <App />}
      </AutomationProvider>
    </ToastProvider>
  </StrictMode>,
)
