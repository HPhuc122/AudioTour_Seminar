import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { App } from './App';
import { SessionProvider } from './contexts/Session';
import { NarrationProvider } from './contexts/Narration';
import './styles.css';
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode><BrowserRouter><SessionProvider><NarrationProvider><App/></NarrationProvider></SessionProvider></BrowserRouter></React.StrictMode>,
);
