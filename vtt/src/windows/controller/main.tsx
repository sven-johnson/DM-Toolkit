import React from 'react'
import ReactDOM from 'react-dom/client'
import { ThemeProvider } from '../../context/ThemeContext'
import { Controller } from './Controller'
import '../../styles/theme.css'
import './controller.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemeProvider>
      <Controller />
    </ThemeProvider>
  </React.StrictMode>,
)
