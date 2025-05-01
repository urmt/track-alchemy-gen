
import React, { useEffect, useRef } from 'react';
import { Slider } from "@/components/ui/slider";

interface InstrumentFaderProps {
  name: string;
  value: number; // dB value
  onChange: (value: number) => void;
}

const InstrumentFader: React.FC<InstrumentFaderProps> = ({ name, value, onChange }) => {
  // Reference to track previous value 
  const prevValueRef = useRef<number>(value);
  
  // Update reference when value changes from parent
  useEffect(() => {
    prevValueRef.current = value;
  }, [value]);
  
  // Convert dB value to percentage for display (dB range from -60 to 0)
  const normalizedValue = ((value + 60) / 60) * 100;
  
  // Convert back from percentage to dB when slider changes
  const handleChange = (newValue: number[]) => {
    const dbValue = (newValue[0] / 100) * 60 - 60;
    onChange(dbValue);
  };
  
  // Format dB value for display
  const formatDb = (db: number): string => {
    if (db <= -60) return "-∞";
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
        <div className="text-xs font-mono mt-1">{formatDb(value)}</div>
      </div>
    </div>
  );
};

export default InstrumentFader;
