
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner, toast } from "@/components/ui/sonner";
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
    // Clear any cached state that could be causing issues
    sessionStorage.removeItem('trackAlchemyState');
    window.location.reload();
  };
  
  // Catch errors in children
  useEffect(() => {
    const errorHandler = (event: ErrorEvent) => {
      console.error("Caught in error boundary:", event.error);
      // Special handling for audio context errors
      if (event.error?.message?.includes('audio') || 
          event.error?.message?.includes('context')) {
        toast.error("Audio system error. Please refresh the page.", {
          description: "This could be due to browser audio limitations.",
          action: {
            label: "Refresh",
            onClick: () => window.location.reload()
          },
          duration: 10000
        });
      }
      
      setError(event.error);
      event.preventDefault();
    };
    
    window.addEventListener('error', errorHandler);
    
    // Also listen for unhandled promise rejections
    const rejectionHandler = (event: PromiseRejectionEvent) => {
      console.error("Unhandled rejection in error boundary:", event.reason);
      
      // Only set error if it's not already set to avoid loops
      if (!error) {
        setError(new Error(event.reason?.message || "Unhandled promise rejection"));
      }
      event.preventDefault();
    };
    
    window.addEventListener('unhandledrejection', rejectionHandler);
    
    // Add global interaction handlers to resume AudioContext anywhere in the app
    const resumeAudioContext = () => {
      // Find any suspended AudioContexts and resume them
      if (typeof window !== 'undefined') {
        // Check if there's a suspended Tone.js context
        try {
          const Tone = window.Tone || (window as any).Tone;
          if (Tone && Tone.getContext && Tone.getContext().rawContext) {
            const context = Tone.getContext().rawContext as AudioContext;
            if (context && context.state === 'suspended') {
              console.log("Global handler: Found suspended Tone AudioContext, attempting to resume");
              context.resume()
                .then(() => console.log("Global handler: AudioContext resumed successfully"))
                .catch(err => console.warn("Global handler: Failed to resume AudioContext", err));
            }
          }
        } catch (err) {
          console.warn("Global handler: Error accessing Tone context", err);
        }
      }
    };
    
    // Attach to multiple event types for maximum compatibility
    window.addEventListener('click', resumeAudioContext);
    window.addEventListener('touchend', resumeAudioContext);
    window.addEventListener('keydown', resumeAudioContext);
    
    return () => {
      window.removeEventListener('error', errorHandler);
      window.removeEventListener('unhandledrejection', rejectionHandler);
      window.removeEventListener('click', resumeAudioContext);
      window.removeEventListener('touchend', resumeAudioContext);
      window.removeEventListener('keydown', resumeAudioContext);
    };
  }, [error]);
  
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
      {/* Ensure TooltipProvider is correctly used with a delayDuration to prevent null issues */}
      <TooltipProvider delayDuration={0}>
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
