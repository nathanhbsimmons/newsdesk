import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import NewsDesk from './NewsDesk.jsx';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <NewsDesk />
  </StrictMode>
);
