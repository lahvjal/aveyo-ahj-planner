import React from 'react';

interface ToggleSwitchProps {
  isOn: boolean;
  onToggle: () => void;
  label: string;
}

const ToggleSwitch: React.FC<ToggleSwitchProps> = ({ isOn, onToggle, label }) => {
  return (
    <div className="flex items-center justify-between py-3">
      <span className="text-white">{label}</span>
      <button 
        onClick={onToggle}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
          isOn ? 'bg-blue-600' : 'bg-gray-700'
        }`}
        role="switch"
        aria-checked={isOn}
      >
        <span 
          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
            isOn ? 'translate-x-6' : 'translate-x-1'
          }`} 
        />
      </button>
    </div>
  );
};

export default ToggleSwitch;
