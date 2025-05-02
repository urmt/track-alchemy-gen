import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { useState, useEffect } from "react";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";

// Create error boundary as a functional component
function ErrorFallback({ error, resetError }: { error: Error | null, resetError: () => void }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background text-foreground">
      <div className="p-6 max-w-md bg-card rounded-lg shadow-lg">
        <h2 className="text-2xl font-bold mb-4">Something went wrong</h2>
        <p className="mb-4 text-destructive">{error?.message || "An unexpected error occurred"}</p>
        <button 
          onClick={resetError}
          className="px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90"
        >
          Try again
        </button>
      </div>
    </div>
  );
}

// Custom error boundary wrapper
function WithErrorBoundary({ children }: { children: React.ReactNode }) {
  const [error, setError] = useState<Error | null>(null);
  
  // Reset error state
  const resetError = () => {
    setError(null);
    window.location.reload();
  };
  
  // Catch errors in children
  useEffect(() => {
    const errorHandler = (event: ErrorEvent) => {
      console.error("Caught in error boundary:", event.error);
      setError(event.error);
      event.preventDefault();
    };
    
    window.addEventListener('error', errorHandler);
    return () => window.removeEventListener('error', errorHandler);
  }, []);
  
  if (error) {
    return <ErrorFallback error={error} resetError={resetError} />;
  }
  
  return <>{children}</>;
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    }
  }
});

const App = () => (
  <WithErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <div className="relative z-0">
          <Toaster />
          <Sonner position="top-center" expand={true} closeButton={true} />
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Index />} />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </div>
      </TooltipProvider>
    </QueryClientProvider>
  </WithErrorBoundary>
);

export default App;
