import React from 'react';
import Link from 'next/link';
import Image from 'next/image';

interface HeaderProps {
  activePage: 'home' | 'map';
}

const Header: React.FC<HeaderProps> = ({ activePage }) => {
  return (
    <header className="flex items-center justify-between py-4 px-6 bg-[#121212] border-b border-[#333333]">
      <div className="flex items-center">
        <div className="mr-4">
          <Image 
            src="/Aveyo-social-icon-BLK.jpg" 
            alt="Aveyo Logo" 
            width={40} 
            height={40}
            className="rounded-md" 
          />
        </div>
        <h1 className="text-xl font-semibold">45 Day Program</h1>
      </div>
      <nav className="flex space-x-2">
        <Link 
          href="/" 
          className={`px-4 py-2 rounded-md ${
            activePage === 'home' 
              ? 'bg-[#0066ff] text-white' 
              : 'bg-transparent text-white hover:bg-[#1e1e1e]'
          }`}
        >
          Home
        </Link>
        <Link 
          href="/map" 
          className={`px-4 py-2 rounded-md ${
            activePage === 'map' 
              ? 'bg-[#0066ff] text-white' 
              : 'bg-transparent text-white hover:bg-[#1e1e1e]'
          }`}
        >
          MAP
        </Link>
        <div className="ml-4 w-8 h-8 rounded-full bg-gray-300 flex items-center justify-center text-black">
          U
        </div>
      </nav>
    </header>
  );
};

export default Header;
