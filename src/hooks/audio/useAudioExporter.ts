
import * as Tone from 'tone';
import { useCallback } from 'react';
import { InstrumentTrack, TrackSettings, TrackDownloadResult } from './types';

export function useAudioExporter() {
  // Function to download the current track
  const downloadTrack = useCallback(async (
    isTrackGenerated: boolean,
    instrumentsRef: React.MutableRefObject<Record<string, InstrumentTrack>>,
    trackSettings: TrackSettings
  ): Promise<TrackDownloadResult> => {
    try {
      if (!isTrackGenerated) {
        return { success: false, error: "No track has been generated yet" };
      }
      
      // Create an offline context to render the track
      console.log("Starting track rendering process...");
      
      const duration = 16; // 16 bars
      const beatsPerBar = 4;
      const bpm = trackSettings.bpm;
      const trackDuration = (duration * beatsPerBar * 60) / bpm;
      
      // Create an offline context
      const offlineContext = new Tone.OfflineContext(2, trackDuration, 44100);
      Tone.setContext(offlineContext);
      
      // Create a master volume node
      const offlineMaster = new Tone.Volume(-6).toDestination();
      
      // Re-create all instruments in the offline context
      const offlineInstruments: Record<string, any> = {};
      
      // Add each instrument to the offline context
      for (const instrument of Object.values(instrumentsRef.current)) {
        if (!instrument.samplePath) continue;
        
        const volumeNode = new Tone.Volume(instrument.volume);
        
        // Create a player for each instrument
        const player = new Tone.Player({
          url: instrument.samplePath,
          loop: true,
        }).connect(volumeNode);
        
        // Connect to the master volume
        volumeNode.connect(offlineMaster);
        
        offlineInstruments[instrument.id] = {
          player,
          volumeNode
        };
      }
      
      // Start all players
      for (const inst of Object.values(offlineInstruments)) {
        if (inst.player) {
          inst.player.start();
        }
      }
      
      // Render the full track
      console.log(`Rendering ${trackDuration} seconds of audio...`);
      const buffer = await offlineContext.render();
      console.log("Rendering complete.");
      
      // Convert the buffer to a WAV file
      const wav = toWav(buffer);
      
      // Create a download link
      const blob = new Blob([wav], { type: 'audio/wav' });
      const url = URL.createObjectURL(blob);
      
      // Create a filename based on track settings
      const filename = `track-${trackSettings.genre}-${trackSettings.key}-${trackSettings.bpm}bpm.wav`;
      
      // Create and click a download link
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      
      // Clean up the URL
      setTimeout(() => {
        URL.revokeObjectURL(url);
      }, 100);
      
      console.log("Track downloaded successfully");
      return { success: true };
    } catch (err) {
      console.error("Error downloading track:", err);
      return { success: false, error: err instanceof Error ? err.message : "Unknown error" };
    } finally {
      // Restore the main context
      Tone.setContext(Tone.getContext());
    }
  }, []);

  // Helper function to convert AudioBuffer to WAV format
  const toWav = (audioBuffer: Tone.ToneAudioBuffer | AudioBuffer) => {
    // Get the actual AudioBuffer
    const buffer = 'get' in audioBuffer ? audioBuffer.get() : audioBuffer;
    
    const numOfChannels = buffer.numberOfChannels;
    const length = buffer.length * numOfChannels * 2; // 2 bytes per sample
    const sampleRate = buffer.sampleRate;
    
    // Create the WAV file buffer
    const buffer1 = new ArrayBuffer(44 + length);
    const data = new DataView(buffer1);
    
    // WAV header
    // "RIFF" chunk descriptor
    writeString(data, 0, 'RIFF');
    data.setUint32(4, 36 + length, true);
    writeString(data, 8, 'WAVE');
    
    // "fmt " sub-chunk
    writeString(data, 12, 'fmt ');
    data.setUint32(16, 16, true); // subchunk size
    data.setUint16(20, 1, true); // PCM format
    data.setUint16(22, numOfChannels, true); // channels
    data.setUint32(24, sampleRate, true); // sample rate
    data.setUint32(28, sampleRate * numOfChannels * 2, true); // byte rate
    data.setUint16(32, numOfChannels * 2, true); // block align
    data.setUint16(34, 16, true); // bits per sample
    
    // "data" sub-chunk
    writeString(data, 36, 'data');
    data.setUint32(40, length, true);
    
    // Write the PCM samples
    let offset = 44;
    for (let i = 0; i < buffer.length; i++) {
      for (let channel = 0; channel < numOfChannels; channel++) {
        const sample = Math.max(-1, Math.min(1, buffer.getChannelData(channel)[i]));
        data.setInt16(offset, sample * 0x7FFF, true);
        offset += 2;
      }
    }
    
    return new Uint8Array(buffer1);
  };
  
  // Helper function to write a string to a DataView
  const writeString = (dataview: DataView, offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      dataview.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  return { downloadTrack };
}
