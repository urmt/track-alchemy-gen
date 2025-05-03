
import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { toast as sonnerToast } from "@/components/ui/sonner";
import { Play, Pause, ChevronDown, Download, RefreshCw } from "lucide-react";
import { useAudioContext } from "@/hooks/useAudioContext";
import { useTrackAudio, type TrackSettings } from "@/hooks/audio/useTrackAudio";
import TestTone from "@/components/TestTone";
import DebugPanel from "@/components/DebugPanel";
import Meters from "@/components/Meters";
import InstrumentFader from "@/components/InstrumentFader";
import GenreSelector from "@/components/GenreSelector";
import { generateChordProgression } from "@/lib/utils";
import SampleManager from "@/components/SampleManager";

const Index = () => {
  const { toast } = useToast();
  const [showDebug, setShowDebug] = useState(false);
  
  // Set up audio context
  const audioContext = useAudioContext();
  
  // Set up track audio - fixing the type mismatch for the startContext prop
  const trackAudio = useTrackAudio({
    masterVolume: audioContext.masterVolume,
    isStarted: audioContext.isStarted,
    // Fix the type mismatch by wrapping the original function
    startContext: async () => {
      const result = await audioContext.startContext();
      // The result is ignored, so we return void
      return;
    },
    getContextId: audioContext.getContextId,
    resetContext: audioContext.resetContext,
  });
  
  // State for track settings
  const [trackSettings, setTrackSettings] = useState<TrackSettings>({
    genre: "rock",
    mood: "energetic",
    bpm: 120,
    key: "C",
    duration: 16,
  });
  
  // Handle reset audio system
  const handleResetAudioSystem = async () => {
    sonnerToast("Resetting Audio System", {
      description: "Please wait while the audio system resets...",
      duration: 3000,
    });
    
    // Stop any playing audio
    if (trackAudio.isPlaying) {
      await trackAudio.togglePlayback();
    }
    
    try {
      // Reset the audio context
      const success = await audioContext.resetContext();
      
      if (success) {
        // Clear session storage
        sessionStorage.removeItem('trackAlchemyState');
        
        sonnerToast("Audio System Reset", {
          description: "Audio system has been reset. You can now generate a new track.",
          duration: 4000,
        });
        
        // Small delay to ensure context is fully reset
        await new Promise(resolve => setTimeout(resolve, 300));
        
        // Try to generate a new track with defaults
        await trackAudio.generateTrack(trackSettings);
      } else {
        throw new Error("Reset operation failed");
      }
    } catch (error) {
      console.error("Reset failed:", error);
      sonnerToast("Reset Failed", {
        description: "Could not reset audio system. Please refresh the page.",
        duration: 8000,
        action: {
          label: "Refresh",
          onClick: () => window.location.reload()
        }
      });
    }
  };
  
  // Handle generate button click
  const handleGenerate = async () => {
    if (!audioContext.isLoaded) {
      sonnerToast("Audio System Not Ready", {
        description: "Audio system is not initialized properly. Try resetting the audio system.",
        dismissible: true,
        duration: 8000,
        action: {
          label: "Reset Audio",
          onClick: handleResetAudioSystem
        }
      });
      return;
    }
    
    try {
      sonnerToast("Generating Track", {
        description: "Creating your track...",
        duration: 3000,
      });
      
      await trackAudio.generateTrack(trackSettings);
      
      // Generate chord progression (just for display in this version)
      const progression = generateChordProgression(
        trackSettings.key, 
        trackSettings.genre, 
        trackSettings.mood
      );
      
      sonnerToast("Track Generated", {
        description: `Created ${trackSettings.genre} track in ${trackSettings.key} with progression: ${progression.join(' - ')}`,
        dismissible: true,
        duration: 5000,
      });
    } catch (error) {
      console.error("Generation failed:", error);
      
      // Special handling for context mismatch errors
      if (error instanceof Error && error.message.includes('context')) {
        sonnerToast("Audio Context Error", {
          description: "Audio system encountered a context error. Try resetting the audio system.",
          duration: 8000,
          action: {
            label: "Reset Audio",
            onClick: handleResetAudioSystem
          },
        });
      } else {
        sonnerToast("Generation Failed", {
          description: "Could not generate track. Try resetting the audio system.",
          dismissible: true,
          duration: 8000,
          action: {
            label: "Reset Audio",
            onClick: handleResetAudioSystem
          },
        });
      }
    }
  };
  
  // Handle download track
  const handleDownloadTrack = async () => {
    try {
      const result = await trackAudio.downloadTrack();
      if (result.success) {
        sonnerToast("Track Downloaded", {
          description: "Your track has been successfully downloaded.",
          dismissible: true,
          duration: 4000,
        });
      } else {
        sonnerToast("Download Failed", {
          description: result.error || "Could not download track",
          dismissible: true,
          duration: 8000,
        });
      }
    } catch (error) {
      console.error("Download error:", error);
      sonnerToast("Download Failed", {
        description: "An error occurred while downloading the track.",
        dismissible: true,
        duration: 8000,
      });
    }
  };
  
  // Effects to handle errors
  useEffect(() => {
    if (audioContext.error) {
      sonnerToast("Audio System Error", {
        description: audioContext.error,
        dismissible: true,
        duration: 8000,
        action: {
          label: "Reset Audio",
          onClick: handleResetAudioSystem
        }
      });
    }
  }, [audioContext.error]);
  
  useEffect(() => {
    if (trackAudio.error) {
      sonnerToast("Track Error", {
        description: trackAudio.error,
        dismissible: true,
        duration: 8000,
      });
    }
  }, [trackAudio.error]);
  
  // Add automatic reset attempt if audio context failed to initialize
  useEffect(() => {
    if (audioContext.error && audioContext.error.includes("Failed to initialize audio context")) {
      // Try to reset the context automatically after a short delay
      const timer = setTimeout(() => {
        console.log("Attempting automatic audio context reset");
        handleResetAudioSystem();
      }, 1500);
      
      return () => clearTimeout(timer);
    }
  }, [audioContext.error]);
  
  return (
    <div className="min-h-screen bg-studio-bg text-white">
      <div className="container mx-auto pt-6 pb-10">
        <header className="mb-6 text-center">
          <h1 className="text-4xl font-bold text-white">Track Alchemy</h1>
          <p className="text-xl text-muted-foreground">Generate professional backing tracks on demand</p>
        </header>
        
        <main className="bg-studio-panel rounded-lg p-6 shadow-xl">
          {/* Track Generation Controls */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <GenreSelector 
              genre={trackSettings.genre}
              setGenre={(genre) => setTrackSettings({...trackSettings, genre})}
              mood={trackSettings.mood}
              setMood={(mood) => setTrackSettings({...trackSettings, mood})}
              bpm={trackSettings.bpm}
              setBpm={(bpm) => setTrackSettings({...trackSettings, bpm})}
              musicalKey={trackSettings.key}
              setMusicalKey={(key) => setTrackSettings({...trackSettings, key})}
            />
            
            <div className="flex flex-col space-y-4">
              <SampleManager />
              <div className="flex flex-wrap justify-between items-center gap-2">
                <div className="flex gap-2">
                  <Button 
                    onClick={handleGenerate}
                    disabled={trackAudio.isLoading}
                    className="bg-studio-accent hover:bg-studio-highlight text-white"
                  >
                    Generate Track
                  </Button>
                  
                  <Button
                    onClick={handleResetAudioSystem}
                    variant="outline"
                    className="flex items-center gap-1"
                    title="Reset audio system if you encounter playback problems"
                  >
                    <RefreshCw className="w-4 h-4" />
                    <span>Reset Audio</span>
                  </Button>
                </div>
                
                <div className="flex gap-2">
                  <Button 
                    onClick={trackAudio.togglePlayback}
                    disabled={trackAudio.isLoading || !trackAudio.isTrackGenerated}
                    className="flex items-center gap-2 bg-studio-accent hover:bg-studio-highlight text-white"
                  >
                    {trackAudio.isPlaying ? (
                      <>
                        <Pause className="w-4 h-4" />
                        <span>Pause</span>
                      </>
                    ) : (
                      <>
                        <Play className="w-4 h-4" />
                        <span>Play</span>
                      </>
                    )}
                  </Button>
                  
                  <Button
                    onClick={handleDownloadTrack}
                    disabled={trackAudio.isLoading || !trackAudio.isTrackGenerated}
                    className="flex items-center gap-2 bg-studio-accent hover:bg-studio-highlight text-white"
                  >
                    <Download className="w-4 h-4" />
                    <span>Download</span>
                  </Button>
                </div>
              </div>
              
              <TestTone playTestTone={audioContext.playTestTone} />
            </div>
          </div>
          
          {/* Meters and Faders */}
          <div className="bg-[#232436] rounded-lg p-4 mb-6">
            <Meters 
              instruments={trackAudio.instruments} 
              masterValue={trackAudio.masterMeterValue} 
            />
            
            <div className="flex justify-center space-x-8 mt-6">
              {trackAudio.instruments.map((instrument) => (
                <InstrumentFader
                  key={instrument.id}
                  name={instrument.name}
                  value={instrument.volume}
                  onChange={(value) => trackAudio.setInstrumentVolume(
                    instrument.id as any, 
                    value
                  )}
                />
              ))}
              
              <InstrumentFader
                name="Master"
                value={audioContext.masterVolume?.volume.value || -12}
                onChange={audioContext.setMasterVolume}
              />
            </div>
          </div>
          
          {/* Debug Panel Toggle */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Switch 
                id="debug-mode" 
                checked={showDebug} 
                onCheckedChange={setShowDebug} 
              />
              <label 
                htmlFor="debug-mode" 
                className="text-sm cursor-pointer flex items-center"
              >
                <span>Debug Mode</span>
                <ChevronDown className={`ml-1 w-4 h-4 transition-transform ${showDebug ? 'rotate-180' : ''}`} />
              </label>
            </div>
            
            {/* Status Text */}
            <div className="text-sm text-muted-foreground">
              {trackAudio.isLoading 
                ? "Loading samples..." 
                : trackAudio.isPlaying 
                  ? "Playing track" 
                  : audioContext.isLoaded 
                    ? "Ready" 
                    : "Audio system initializing..."}
            </div>
          </div>
          
          {/* Debug Panel */}
          {showDebug && (
            <div className="mt-4">
              <DebugPanel 
                audioContextState={audioContext}
                trackSettings={trackAudio.trackSettings}
                isLoading={trackAudio.isLoading}
                isPlaying={trackAudio.isPlaying}
                error={trackAudio.error || audioContext.error}
                instruments={trackAudio.instruments}
              />
            </div>
          )}
        </main>
        
        <footer className="mt-6 text-center text-sm text-muted-foreground">
          <p>Track Alchemy © {new Date().getFullYear()}</p>
          <p className="mt-1">For development purposes. Samples not included.</p>
        </footer>
      </div>
    </div>
  );
};

export default Index;
