import React from 'react'
import ReactDOM from 'react-dom/client'
import './index.css'
import App from './App'
import  { BrowserRouter } from 'react-router-dom'
import '@fontsource/inter/latin.css'
import { Toaster } from 'sonner'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
      <Toaster richColors position="top-right" />
    </BrowserRouter>
  </React.StrictMode>
)