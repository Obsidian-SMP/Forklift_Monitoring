// ==============================================================================
// File: src/main.tsx
// Description: React Application DOM Entry Point.
// Purpose: Mounts the top-level App component into the document DOM with StrictMode.
// ==============================================================================

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
