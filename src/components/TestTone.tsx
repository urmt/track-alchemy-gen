
import React from 'react';
import { Button } from "@/components/ui/button";

interface TestToneProps {
  playTestTone: () => void;
}

const TestTone: React.FC<TestToneProps> = ({ playTestTone }) => {
  return (
    <div className="flex flex-col items-center p-4 bg-studio-panel rounded-lg">
      <h3 className="text-lg font-semibold mb-2">Audio Test</h3>
      <Button 
        onClick={playTestTone}
        variant="outline" 
        className="bg-studio-accent hover:bg-studio-highlight text-white"
      >
        Play Test Tone (440Hz)
      </Button>
      <p className="text-sm mt-2 text-muted-foreground">
        Click to verify audio output is working
      </p>
    </div>
  );
};

export default TestTone;
