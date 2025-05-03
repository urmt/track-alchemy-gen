
import { MidiWriter } from 'midi-writer-js';
import { TrackSettings } from './types';

export function useMidiExporter() {
  const downloadMidiTrack = (
    isTrackGenerated: boolean,
    trackSettings: TrackSettings
  ) => {
    if (!isTrackGenerated) {
      return { success: false, error: "No track has been generated yet" };
    }

    try {
      // Create a new MIDI writer instance
      const tracks: MidiWriter.Track[] = [];

      // Create tracks for each instrument
      const instrumentTypes = ['drums', 'bass', 'guitar', 'keys'];
      
      // Define basic note patterns based on genre and mood
      const getNotesForInstrument = (instrument: string) => {
        const keyNotes: Record<string, string[]> = {
          'C': ['C4', 'E4', 'G4', 'C5'],
          'D': ['D4', 'F#4', 'A4', 'D5'],
          'E': ['E4', 'G#4', 'B4', 'E5'],
          'F': ['F4', 'A4', 'C5', 'F5'],
          'G': ['G4', 'B4', 'D5', 'G5'],
          'A': ['A4', 'C#5', 'E5', 'A5'],
          'B': ['B4', 'D#5', 'F#5', 'B5'],
        };
        
        // Get notes for the selected key (default to C if not found)
        const notes = keyNotes[trackSettings.key] || keyNotes['C'];
        
        // Create different patterns per instrument
        switch (instrument) {
          case 'drums':
            return [
              { note: 'C2', duration: '4' }, // Kick
              { note: 'D2', duration: '8' }, // Snare
              { note: 'F#2', duration: '16' }, // Hi-hat
              { note: 'D2', duration: '8' }, // Snare
            ];
          case 'bass':
            return [
              { note: notes[0].replace('4', '2'), duration: '4' },
              { note: notes[2].replace('4', '2'), duration: '4' },
              { note: notes[0].replace('4', '2'), duration: '2' },
            ];
          case 'guitar':
            return [
              { note: [notes[0], notes[2]], duration: '4' },
              { note: [notes[1], notes[3]], duration: '4' },
              { note: [notes[0], notes[2]], duration: '2' },
            ];
          case 'keys':
            return [
              { note: notes, duration: '1' },
            ];
          default:
            return [{ note: 'C4', duration: '4' }];
        }
      };

      // Create a MIDI track for each instrument
      instrumentTypes.forEach((instrument, i) => {
        const track = new MidiWriter.Track();
        
        // Set instrument based on general MIDI standards
        const instrumentGMNumber = {
          'drums': 118, // Synth Drum
          'bass': 33,   // Electric Bass
          'guitar': 27, // Clean Electric Guitar
          'keys': 0     // Acoustic Grand Piano
        };
        
        // Set the instrument voice
        track.addEvent(
          new MidiWriter.ProgramChangeEvent({
            instrument: instrumentGMNumber[instrument as keyof typeof instrumentGMNumber]
          })
        );

        // Add tempo
        track.setTempo(trackSettings.bpm);
        
        // If this is drums, set to channel 10 (9 in zero-based) which is standard for drums in MIDI
        if (instrument === 'drums') {
          track.setChannel(9);
        } else {
          track.setChannel(i);
        }
        
        // Generate notes based on instrument type
        const notesPattern = getNotesForInstrument(instrument);
        
        // Repeat the pattern a few times
        for (let bar = 0; bar < trackSettings.duration / 4; bar++) {
          notesPattern.forEach(noteInfo => {
            const event = new MidiWriter.NoteEvent({
              pitch: noteInfo.note,
              duration: noteInfo.duration,
              velocity: 100
            });
            track.addEvent(event);
          });
        }
        
        tracks.push(track);
      });

      // Generate a writer and include all tracks
      const writer = new MidiWriter.Writer(tracks);
      
      // Create MIDI data and download
      const midiData = writer.buildFile();
      
      // Create a Blob for the MIDI data
      const blob = new Blob([midiData], { type: 'audio/midi' });
      const url = URL.createObjectURL(blob);
      
      // Create a filename based on track settings
      const filename = `midi-${trackSettings.genre}-${trackSettings.key}-${trackSettings.bpm}bpm.mid`;
      
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
      
      return { success: true };
    } catch (err) {
      console.error("Error creating MIDI file:", err);
      return { 
        success: false, 
        error: err instanceof Error ? err.message : "Unknown error creating MIDI file" 
      };
    }
  };

  return { downloadMidiTrack };
}
