import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { AutomationProvider } from './providers/AutomationProvider'
import './styles.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AutomationProvider>
      <App />
    </AutomationProvider>
  </StrictMode>,
)
