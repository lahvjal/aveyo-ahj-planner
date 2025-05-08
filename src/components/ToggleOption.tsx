import React from 'react';

interface ToggleOptionProps {
  label: string;
  isOn: boolean;
  onToggle: () => void;
  className?: string;
}

const ToggleOption: React.FC<ToggleOptionProps> = ({
  label,
  isOn,
  onToggle,
  className = ''
}) => {
  const handleToggle = () => {
    console.log(`[ToggleOption] "${label}" clicked. Current state: ${isOn}, changing to: ${!isOn}`);
    onToggle();
  };

  return (
    <div 
      className={`flex items-center justify-between ${className} cursor-pointer`}
      onClick={handleToggle}
      role="button"
      tabIndex={0}
      aria-pressed={isOn}
    >
      <span className="text-sm font-medium text-white">{label}</span>
      <div className="flex items-center justify-between">
        <div className={`w-10 h-5 rounded-full relative ${isOn ? 'bg-blue-500' : 'bg-gray-600'}`}>
          <div 
            className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transform transition-transform ${isOn ? 'translate-x-5' : ''}`}
          ></div>
        </div>
      </div>
    </div>
  );
};

export default ToggleOption;
