import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { AutomationProvider } from './providers/AutomationProvider'
import { ToastProvider } from './providers/ToastProvider'
import './styles.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ToastProvider>
      <AutomationProvider>
        <App />
      </AutomationProvider>
    </ToastProvider>
  </StrictMode>,
)
