
import React from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface GenreSelectorProps {
  genre: string;
  setGenre: (genre: string) => void;
  mood: string;
  setMood: (mood: string) => void;
  bpm: number;
  setBpm: (bpm: number) => void;
  musicalKey: string;
  setMusicalKey: (key: string) => void;
}

const GenreSelector: React.FC<GenreSelectorProps> = ({ 
  genre, 
  setGenre, 
  mood, 
  setMood, 
  bpm, 
  setBpm, 
  musicalKey, 
  setMusicalKey 
}) => {
  // Genre options
  const genres = ["rock", "pop", "hip-hop", "jazz", "electronic", "ambient"];
  
  // Mood options
  const moods = ["energetic", "relaxed", "dark", "upbeat", "atmospheric", "intense"];
  
  // Musical key options
  const keys = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
  
  return (
    <div className="p-4 bg-studio-panel rounded-lg">
      <h3 className="text-lg font-semibold mb-4">Track Settings</h3>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="text-sm">Genre</label>
          <Select value={genre} onValueChange={setGenre}>
            <SelectTrigger>
              <SelectValue placeholder="Select Genre" />
            </SelectTrigger>
            <SelectContent>
              {genres.map(g => (
                <SelectItem key={g} value={g}>{g}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        
        <div className="space-y-2">
          <label className="text-sm">Mood</label>
          <Select value={mood} onValueChange={setMood}>
            <SelectTrigger>
              <SelectValue placeholder="Select Mood" />
            </SelectTrigger>
            <SelectContent>
              {moods.map(m => (
                <SelectItem key={m} value={m}>{m}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        
        <div className="space-y-2">
          <label className="text-sm">BPM</label>
          <Select value={bpm.toString()} onValueChange={(val) => setBpm(Number(val))}>
            <SelectTrigger>
              <SelectValue placeholder="Select BPM" />
            </SelectTrigger>
            <SelectContent>
              {[60, 80, 90, 100, 120, 140, 160, 180].map(b => (
                <SelectItem key={b} value={b.toString()}>{b}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        
        <div className="space-y-2">
          <label className="text-sm">Key</label>
          <Select value={musicalKey} onValueChange={setMusicalKey}>
            <SelectTrigger>
              <SelectValue placeholder="Select Key" />
            </SelectTrigger>
            <SelectContent>
              {keys.map(k => (
                <SelectItem key={k} value={k}>{k}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
};

export default GenreSelector;
