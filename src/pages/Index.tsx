
import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Play, Pause, ChevronDown, Download } from "lucide-react";
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
  
  // Set up track audio
  const trackAudio = useTrackAudio({
    masterVolume: audioContext.masterVolume,
    isStarted: audioContext.isStarted,
    startContext: audioContext.startContext,
  });
  
  // State for track settings
  const [trackSettings, setTrackSettings] = useState<TrackSettings>({
    genre: "rock",
    mood: "energetic",
    bpm: 120,
    key: "C",
    duration: 16,
  });
  
  // Handle generate button click
  const handleGenerate = async () => {
    if (!audioContext.isLoaded) {
      toast({
        title: "Audio Context Error",
        description: "Audio system could not be initialized. Please try reloading.",
        variant: "destructive",
      });
      return;
    }
    
    try {
      await trackAudio.generateTrack(trackSettings);
      
      // Generate chord progression (just for display in this version)
      const progression = generateChordProgression(
        trackSettings.key, 
        trackSettings.genre, 
        trackSettings.mood
      );
      
      toast({
        title: "Track Generated",
        description: `Created ${trackSettings.genre} track in ${trackSettings.key} with progression: ${progression.join(' - ')}`,
      });
    } catch (error) {
      toast({
        title: "Generation Failed",
        description: "Could not generate track. See debug panel for details.",
        variant: "destructive",
      });
    }
  };
  
  // Handle download track
  const handleDownloadTrack = async () => {
    try {
      const result = await trackAudio.downloadTrack();
      if (result.success) {
        toast({
          title: "Track Downloaded",
          description: "Your track has been successfully downloaded.",
        });
      } else {
        toast({
          title: "Download Failed",
          description: result.error || "Could not download track",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Download Failed",
        description: "An error occurred while downloading the track.",
        variant: "destructive",
      });
    }
  };
  
  // Effects to handle errors
  useEffect(() => {
    if (audioContext.error) {
      toast({
        title: "Audio Error",
        description: audioContext.error,
        variant: "destructive",
      });
    }
  }, [audioContext.error, toast]);
  
  useEffect(() => {
    if (trackAudio.error) {
      toast({
        title: "Track Error",
        description: trackAudio.error,
        variant: "destructive",
      });
    }
  }, [trackAudio.error, toast]);
  
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
                <Button 
                  onClick={handleGenerate}
                  disabled={trackAudio.isLoading}
                  className="bg-studio-accent hover:bg-studio-highlight text-white"
                >
                  Generate Track
                </Button>
                
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
                  : "Ready"}
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
                error={trackAudio.error}
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
