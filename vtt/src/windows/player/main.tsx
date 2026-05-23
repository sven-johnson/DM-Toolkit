import React from 'react'
import ReactDOM from 'react-dom/client'
import { ThemeProvider } from '../../context/ThemeContext'
import { PlayerView } from './PlayerView'
import '../../styles/theme.css'
import './player.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemeProvider>
      <PlayerView />
    </ThemeProvider>
  </React.StrictMode>,
)
