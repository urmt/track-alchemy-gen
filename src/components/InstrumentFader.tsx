
import React, { useEffect, useRef, useState } from 'react';
import { Slider } from "@/components/ui/slider";

interface InstrumentFaderProps {
  name: string;
  value: number; // dB value
  onChange: (value: number) => void;
}

const InstrumentFader: React.FC<InstrumentFaderProps> = ({ name, value, onChange }) => {
  // Keep a local state for UI updates
  const [localValue, setLocalValue] = useState<number>(value);
  
  // Reference to track if this is an internal update
  const isInternalUpdateRef = useRef<boolean>(false);
  
  // Update local state when prop value changes from parent
  useEffect(() => {
    if (!isInternalUpdateRef.current && Math.abs(localValue - value) > 0.1) {
      console.log(`${name} fader updating from props: ${value}dB`);
      setLocalValue(value);
    }
    isInternalUpdateRef.current = false;
  }, [value, name, localValue]);
  
  // Convert dB value to percentage for display (dB range from -60 to 0)
  const normalizedValue = ((localValue + 60) / 60) * 100;
  
  // Convert back from percentage to dB when slider changes
  const handleChange = (newValue: number[]) => {
    const dbValue = (newValue[0] / 100) * 60 - 60;
    
    // Set flag to prevent feedback loop
    isInternalUpdateRef.current = true;
    
    // Update local state immediately for responsive UI
    setLocalValue(dbValue);
    
    // Propagate to parent component
    console.log(`${name} fader changed: ${dbValue.toFixed(1)}dB`);
    onChange(dbValue);
  };
  
  // Format dB value for display
  const formatDb = (db: number): string => {
    if (db <= -59.8) return "-∞";
    return `${db.toFixed(1)} dB`;
  };

  return (
    <div className="flex flex-col items-center">
      <span className="text-sm font-medium mb-1">{name}</span>
      <div className="flex flex-col items-center h-40 justify-between">
        <div className="h-32 flex items-center">
          <Slider
            value={[normalizedValue]}
            min={0}
            max={100}
            step={0.1}
            orientation="vertical"
            className="h-full"
            onValueChange={handleChange}
          />
        </div>
        <div className="text-xs font-mono mt-1">{formatDb(localValue)}</div>
      </div>
    </div>
  );
};

export default InstrumentFader;
