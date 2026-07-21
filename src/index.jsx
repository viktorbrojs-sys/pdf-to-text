import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles.css';

console.log('index.jsx loaded');

try {
  const container = document.getElementById('root');
  console.log('Root container:', container);
  
  const root = createRoot(container);
  console.log('React root created');
  
  root.render(<App />);
  console.log('App rendered');
} catch (error) {
  console.error('Failed to render app:', error);
  document.getElementById('root').innerHTML = 
    '<div style="padding:20px;color:#ff6b6b;">Failed to load: ' + error.message + '</div>';
}
