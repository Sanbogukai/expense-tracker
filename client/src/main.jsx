// The client's entry point: Vite loads this file first (see index.html).

// StrictMode runs extra checks in development, such as running effects twice to expose bugs.
import { StrictMode } from 'react'
// createRoot connects React to a real element on the page.
import { createRoot } from 'react-dom/client'
// Global styles; Vite bundles the CSS when it sees it imported.
import './index.css'
// The top-level component that holds the whole app.
import App from './App.jsx'

// Finds <div id="root"> in index.html and renders the app inside it.
createRoot(document.getElementById('root')).render(
  // StrictMode adds no visible output; it only checks <App /> and everything under it.
  <StrictMode>
    <App />
  </StrictMode>,
)
