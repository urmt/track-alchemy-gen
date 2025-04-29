
import React from 'react';
import { AudioContextState } from '@/hooks/useAudioContext';
import { TrackSettings, InstrumentTrack } from '@/hooks/useTrackAudio';
import { Badge } from "@/components/ui/badge";

interface DebugPanelProps {
  audioContextState: AudioContextState;
  trackSettings: TrackSettings;
  isLoading: boolean;
  isPlaying: boolean;
  error: string | null;
  instruments?: InstrumentTrack[];
}

const DebugPanel: React.FC<DebugPanelProps> = ({ 
  audioContextState, 
  trackSettings, 
  isLoading, 
  isPlaying,
  error,
  instruments = []
}) => {
  return (
    <div className="p-4 bg-studio-panel rounded-lg font-mono">
      <h3 className="text-lg font-semibold mb-2">Debug Panel</h3>
      <div className="text-xs space-y-2 max-h-60 overflow-auto">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <div><span className="text-studio-accent">AudioContext:</span> {audioContextState.isLoaded ? "Loaded" : "Not Loaded"}</div>
            <div><span className="text-studio-accent">Context Started:</span> {audioContextState.isStarted ? "Yes" : "No"}</div>
            <div><span className="text-studio-accent">Loading Samples:</span> {isLoading ? "Yes" : "No"}</div>
            <div><span className="text-studio-accent">Playback:</span> {isPlaying ? "Playing" : "Stopped"}</div>
            <div><span className="text-studio-accent">BPM:</span> {trackSettings.bpm}</div>
            <div><span className="text-studio-accent">Key:</span> {trackSettings.key}</div>
            <div><span className="text-studio-accent">Genre:</span> {trackSettings.genre}</div>
            <div><span className="text-studio-accent">Mood:</span> {trackSettings.mood}</div>
          </div>
          
          <div className="space-y-1">
            <div className="mb-1"><span className="text-studio-accent">Sample Status:</span></div>
            {instruments.map(inst => (
              <div key={inst.id} className="flex items-center gap-1.5">
                <span className="text-studio-accent">{inst.name}:</span>
                <Badge 
                  variant="outline" 
                  className={`text-xs ${
                    inst.loadingState === 'loaded' ? 'bg-green-500/20 text-green-500' : 
                    inst.loadingState === 'loading' ? 'bg-yellow-500/20 text-yellow-500' : 
                    inst.loadingState === 'error' ? 'bg-red-500/20 text-red-500' : 
                    'bg-gray-500/20 text-gray-400'
                  }`}
                >
                  {inst.loadingState === 'loaded' ? 'Loaded' :
                   inst.loadingState === 'loading' ? 'Loading' :
                   inst.loadingState === 'error' ? 'Error' :
                   'Not loaded'}
                </Badge>
                {inst.samplePath && (
                  <span className="text-xs text-muted-foreground truncate max-w-[120px]">
                    {inst.samplePath.split('/').pop()}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
        
        {error && (
          <div className="mt-2 p-2 bg-destructive/10 text-destructive rounded">
            <span className="text-studio-accent">Error:</span> {error}
          </div>
        )}
      </div>
    </div>
  );
};

export default DebugPanel;
