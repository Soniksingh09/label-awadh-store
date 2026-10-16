import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import Admin from './Admin.jsx';
import './store.css';
import './admin.css';

const isAdminPath = /^\/admin(?:\/|$)/i.test(window.location.pathname);
createRoot(document.getElementById('root')).render(isAdminPath ? <Admin /> : <App />);
