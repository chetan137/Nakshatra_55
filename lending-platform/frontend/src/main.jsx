import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import { Toaster } from 'react-hot-toast';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Toaster
      position="top-center"
      toastOptions={{
        duration: 4000,
        style: { fontFamily: 'Inter, sans-serif', fontSize: '14px', borderRadius: '12px' },
      }}
    />
    <App />
  </React.StrictMode>,
)
