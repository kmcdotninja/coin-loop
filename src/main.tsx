import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles.css';

// inside the deck (?embed=1): a plain white page, so only the stage and the panel show on the slide
if (new URLSearchParams(location.search).has('embed')) document.documentElement.classList.add('embed');

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
