import React, { useEffect, useRef } from 'react';

interface MeterProps {
  value: number; // 0-100 range
  label: string;
}

interface MeterSegment {
  height: number;
  color: string;
}

const Meter: React.FC<MeterProps> = ({ value, label }) => {
  // Keep track of previous value for smoother animation
  const prevValueRef = useRef<number>(value);
  
  // Update ref when value changes
  useEffect(() => {
    prevValueRef.current = value;
  }, [value]);
  
  // Define segments for green, yellow, red meter sections
  const segments: MeterSegment[] = [
    // Green segments (0-70%)
    ...Array(7).fill(0).map(() => ({
      height: 10,
      color: 'bg-studio-meter-low',
    })),
    // Yellow segments (70-90%)
    ...Array(2).fill(0).map(() => ({
      height: 10,
      color: 'bg-studio-meter-mid',
    })),
    // Red segment (90-100%)
    { height: 10, color: 'bg-studio-meter-high' },
  ];

  // Calculate how many segments to light up
  const activeLevels = Math.floor((value || 0) / 10);
  
  return (
    <div className="flex flex-col items-center">
      <div className="level-meter flex flex-col-reverse gap-[2px]">
        {segments.map((segment, index) => (
          <div 
            key={index}
            className={`meter-segment ${segment.color} ${index < activeLevels ? 'opacity-100' : 'opacity-20'}`}
            style={{ 
              height: `${segment.height}px`, 
              width: '8px',
              borderRadius: '1px',
              transition: 'transform 0.05s ease, opacity 0.05s ease',
              transform: index < activeLevels ? 'scaleY(1)' : 'scaleY(0.5)'
            }}
          />
        ))}
      </div>
      <span className="text-xs mt-1">{label}</span>
    </div>
  );
};

interface MeterGridProps {
  instruments: { id: string; name: string; meterValue: number }[];
  masterValue: number;
}

const MeterGrid: React.FC<MeterGridProps> = ({ instruments, masterValue }) => {
  // Ensure we have valid data by providing fallbacks
  const safeInstruments = instruments.map(instrument => ({
    ...instrument,
    meterValue: isNaN(instrument.meterValue) ? 0 : instrument.meterValue
  }));
  
  const safeMasterValue = isNaN(masterValue) ? 0 : masterValue;
  
  return (
    <div className="flex space-x-4 justify-center items-end p-4">
      {safeInstruments.map((instrument) => (
        <Meter 
          key={instrument.id} 
          value={instrument.meterValue} 
          label={instrument.name} 
        />
      ))}
      <Meter value={safeMasterValue} label="Master" />
    </div>
  );
};

export default MeterGrid;
