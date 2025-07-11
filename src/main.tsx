
import { createRoot } from 'react-dom/client'
import { StrictMode } from 'react'
import App from './App.tsx'
import './index.css'

// Add global error handler with improved debugging
window.addEventListener('error', (event) => {
  console.error('Global error caught:', event.error);
  // Add more detailed logging for debugging UI interactivity issues
  console.error('Error details:', {
    message: event.error?.message,
    stack: event.error?.stack,
    type: event.type,
    target: event.target
  });
  
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

// Add click event debugging to help diagnose UI interactivity issues
if (process.env.NODE_ENV !== 'production') {
  document.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    console.log('Click registered on:', target.tagName, target.className, e);
  });
}

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
