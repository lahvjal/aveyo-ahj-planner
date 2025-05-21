import React from 'react';
import Image from 'next/image';
import { FiLogOut } from 'react-icons/fi';
import { useAuth } from '@/utils/AuthContext';

interface MobileHeaderProps {
  title?: string;
  onLogout?: () => void;
}

const MobileHeader: React.FC<MobileHeaderProps> = ({ 
  title = 'My Aveyo',
  onLogout
}) => {
  const { signOut } = useAuth();
  
  const handleLogout = () => {
    if (onLogout) {
      onLogout();
    } else {
      signOut();
    }
  };

  return (
    <div className="flex items-center justify-between px-4 py-3 bg-gray-900 border-b border-gray-800">
      <div className="flex items-center">
        <Image
          src="/Aveyo-social-icon-BLK.jpg"
          alt="Aveyo Logo"
          width={30}
          height={30}
          className="mr-2"
        />
        <h1 className="text-lg font-medium text-white">My Aveyo</h1>
      </div>
      <div className="flex items-center">
        <button 
          onClick={handleLogout}
          className="p-2 text-gray-400 hover:text-white focus:outline-none"
          aria-label="Log out"
        >
          <FiLogOut size={20} />
        </button>
      </div>
    </div>
  );
};

export default MobileHeader;
