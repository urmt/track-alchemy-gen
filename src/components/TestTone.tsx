
import React, { useState, useCallback } from 'react';
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/sonner";

interface TestToneProps {
  playTestTone: () => void;
}

const TestTone: React.FC<TestToneProps> = ({ playTestTone }) => {
  const [playing, setPlaying] = useState(false);
  
  const handlePlayTestTone = useCallback(() => {
    setPlaying(true);
    
    toast("Playing test tone", {
      description: "You should hear a 440Hz sine wave",
      dismissible: true,
      duration: 2000
    });
    
    // Try to play the test tone inside user gesture handler (click event)
    try {
      playTestTone();
    } catch (err) {
      console.error("Error playing test tone:", err);
      toast("Error", {
        description: "Could not play test tone. Please check your audio settings and permissions.",
        dismissible: true,
        duration: 5000
      });
    }
    
    // Reset button state after test tone would be completed
    setTimeout(() => {
      setPlaying(false);
    }, 800); // Slightly longer than the tone duration to ensure completion
  }, [playTestTone]);
  
  return (
    <div className="flex flex-col items-center p-4 bg-studio-panel rounded-lg">
      <h3 className="text-lg font-semibold mb-2">Audio Test</h3>
      <Button 
        onClick={handlePlayTestTone}
        variant="outline" 
        className="bg-studio-accent hover:bg-studio-highlight text-white"
        disabled={playing}
      >
        {playing ? "Playing..." : "Play Test Tone (440Hz)"}
      </Button>
      <p className="text-sm mt-2 text-muted-foreground">
        Click to verify audio output is working
      </p>
    </div>
  );
};

export default TestTone;
