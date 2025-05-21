import React from 'react';
import { FiList, FiMap, FiUser } from 'react-icons/fi';

interface BottomNavbarProps {
  activeView: 'list' | 'map' | 'projects';
  onChangeView: (view: 'list' | 'map' | 'projects') => void;
}

const BottomNavbar: React.FC<BottomNavbarProps> = ({ activeView, onChangeView }) => {
  return (
    <div className="fixed bottom-0 left-0 right-0 bg-gray-900 border-t border-gray-800 flex justify-around items-center h-16 z-50">
      <button
        onClick={() => onChangeView('list')}
        className={`flex flex-col items-center justify-center w-1/3 h-full ${
          activeView === 'list' ? 'text-blue-500' : 'text-gray-400'
        }`}
      >
        <FiList size={20} />
        <span className="text-xs mt-1">Entities</span>
      </button>
      
      <button
        onClick={() => onChangeView('map')}
        className={`flex flex-col items-center justify-center w-1/3 h-full ${
          activeView === 'map' ? 'text-blue-500' : 'text-gray-400'
        }`}
      >
        <FiMap size={20} />
        <span className="text-xs mt-1">Map</span>
      </button>
      
      <button
        onClick={() => onChangeView('projects')}
        className={`flex flex-col items-center justify-center w-1/3 h-full ${
          activeView === 'projects' ? 'text-blue-500' : 'text-gray-400'
        }`}
      >
        <FiUser size={20} />
        <span className="text-xs mt-1">My Projects</span>
      </button>
    </div>
  );
};

export default BottomNavbar;
