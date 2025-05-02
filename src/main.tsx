
import { createRoot } from 'react-dom/client'
import { StrictMode } from 'react'
import App from './App.tsx'
import './index.css'

// Add global error handler
window.addEventListener('error', (event) => {
  console.error('Global error caught:', event.error);
  // Prevent white screen by showing an error message
  if (document.body.innerHTML === '') {
    document.body.innerHTML = `
      <div style="padding: 20px; text-align: center;">
        <h2>Something went wrong</h2>
        <p>Please try refreshing the page.</p>
        <button onclick="window.location.reload()" style="padding: 10px 20px; margin-top: 20px;">
          Reload Page
        </button>
      </div>
    `;
  }
});

try {
  const rootElement = document.getElementById("root");
  if (!rootElement) throw new Error("Root element not found");
  
  const root = createRoot(rootElement);
  root.render(
    <StrictMode>
      <App />
    </StrictMode>
  );
  
  console.log("Application mounted successfully");
} catch (error) {
  console.error("Failed to render application:", error);
  document.body.innerHTML = `
    <div style="padding: 20px; text-align: center;">
      <h2>Application Failed to Load</h2>
      <p>Please try refreshing the page.</p>
      <button onclick="window.location.reload()" style="padding: 10px 20px; margin-top: 20px;">
        Reload Page
      </button>
    </div>
  `;
}
