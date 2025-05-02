import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useAuth } from '@/utils/AuthContext';

interface HeaderProps {
  activePage?: 'home' | 'projects';
}

const Header: React.FC<HeaderProps> = ({ activePage = 'projects' }) => {
  const { signOut, userProfile } = useAuth();

  const handleLogout = async () => {
    await signOut();
    // The redirect will be handled by the AuthContext
  };

  return (
    <header className="flex items-center justify-between py-4 px-6 bg-[#121212] border-b border-[#333333]">
      <div className="flex items-center">
        <div className="mr-4">
          <Link href="/">
            <Image 
              src="/Aveyo-social-icon-BLK.jpg" 
              alt="Aveyo Logo" 
              width={40} 
              height={40}
              className="rounded-md" 
            />
          </Link>
        </div>
        <h1 className="text-xl font-semibold">Project Browser</h1>
      </div>
      <nav className="flex space-x-2 items-center">
        <Link 
          href="/" 
          className={`px-4 py-2 rounded-md ${
            activePage === 'projects'
              ? 'bg-[#0066ff] text-white' 
              : 'bg-transparent text-white hover:bg-[#1e1e1e]'
          }`}
        >
          Projects
        </Link>
        <button 
          onClick={handleLogout}
          className="ml-4 px-3 py-1.5 rounded-md bg-red-600 hover:bg-red-700 text-white text-sm font-medium transition-colors"
        >
          Logout
        </button>
      </nav>
    </header>
  );
};

export default Header;
