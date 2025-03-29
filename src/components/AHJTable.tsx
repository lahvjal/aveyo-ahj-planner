import React from 'react';
import { FiMapPin } from 'react-icons/fi';

export interface AHJ {
  id: string;
  name: string;
  county: string;
  zip: string;
  classification: 'A' | 'B' | 'C' | null;
  address?: string;
  latitude?: number;
  longitude?: number;
}

interface AHJTableProps {
  ahjs: AHJ[];
  onViewOnMap: (ahj: AHJ) => void;
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

const AHJTable: React.FC<AHJTableProps> = ({
  ahjs,
  onViewOnMap,
  currentPage,
  totalPages,
  onPageChange,
}) => {
  return (
    <div className="w-full flex flex-col h-[calc(100vh-12rem)] min-h-[640px]">
      <h2 className="text-xl font-semibold mb-4">AHJ Classification Data</h2>
      
      <div className="overflow-hidden rounded-md border border-[#333333] flex-1 flex flex-col">
        <div className="overflow-auto flex-1">
          <table className="min-w-full divide-y divide-[#333333]">
            <thead className="bg-[#1e1e1e] sticky top-0">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                  AHJ Name
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                  County
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                  ZIP
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                  Class Status
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-[#121212] divide-y divide-[#333333]">
              {ahjs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-4 text-center text-gray-400">
                    No AHJs found
                  </td>
                </tr>
              ) : (
                ahjs.map((ahj) => (
                  <tr key={ahj.id} className="hover:bg-[#1e1e1e]">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-white">
                      {ahj.name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                      {ahj.county}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                      {ahj.zip}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <span 
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          ahj.classification === 'A' 
                            ? 'bg-blue-900 text-blue-100' 
                            : ahj.classification === 'B'
                              ? 'bg-orange-900 text-orange-100'
                              : ahj.classification === 'C'
                                ? 'bg-red-900 text-red-100'
                                : 'bg-gray-700 text-gray-300'
                        }`}
                      >
                        {ahj.classification ? `Class ${ahj.classification}` : 'Unknown'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                      <button
                        onClick={() => onViewOnMap(ahj)}
                        className="inline-flex items-center px-3 py-1 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-[#0066ff] hover:bg-[#0052cc] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#0066ff]"
                      >
                        <FiMapPin className="mr-1" />
                        View On Map
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        
        {/* Pagination controls */}
        <div className="bg-[#1e1e1e] px-4 py-3 flex items-center justify-between border-t border-[#333333]">
          {totalPages > 1 && (
            <div className="text-sm text-gray-400">
              Showing {ahjs.length > 0 ? (currentPage - 1) * 20 + 1 : 0} to {Math.min(currentPage * 20, (currentPage - 1) * 20 + ahjs.length)} of {totalPages * 20} entries
            </div>
          )}
          <div className="flex space-x-1">
            <button
              onClick={() => onPageChange(currentPage - 1)}
              disabled={currentPage === 1}
              className={`px-3 py-1 rounded-md ${
                currentPage === 1
                  ? 'bg-[#1e1e1e] text-gray-500 cursor-not-allowed'
                  : 'bg-[#1e1e1e] text-white hover:bg-[#333333]'
              }`}
            >
              Prev
            </button>
            
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              // Show pages around current page
              let pageNum;
              if (totalPages <= 5) {
                pageNum = i + 1;
              } else if (currentPage <= 3) {
                pageNum = i + 1;
              } else if (currentPage >= totalPages - 2) {
                pageNum = totalPages - 4 + i;
              } else {
                pageNum = currentPage - 2 + i;
              }
              
              return (
                <button
                  key={pageNum}
                  onClick={() => onPageChange(pageNum)}
                  className={`px-3 py-1 rounded-md ${
                    currentPage === pageNum
                      ? 'bg-[#0066ff] text-white'
                      : 'bg-[#1e1e1e] text-white hover:bg-[#333333]'
                  }`}
                >
                  {pageNum}
                </button>
              );
            })}
            
            <button
              onClick={() => onPageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
              className={`px-3 py-1 rounded-md ${
                currentPage === totalPages
                  ? 'bg-[#1e1e1e] text-gray-500 cursor-not-allowed'
                  : 'bg-[#1e1e1e] text-white hover:bg-[#333333]'
              }`}
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AHJTable;
