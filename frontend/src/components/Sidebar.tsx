// import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { User } from '../hooks/useAuth';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  user: User;
}

const navigation = [
  { name: 'Dashboard', href: '/', icon: 'M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2-2z' },
  { name: 'Marquage Présence', href: '/map', icon: 'M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z' },
  { name: 'Mon Profil', href: '/profile', icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z' },
  { name: 'Agents', href: '/agents', icon: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z' },
  { name: 'Rapports', href: '/reports', icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z' },
];

const adminNavigation = [
  { name: 'Administration', href: '/admin', icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z' },
];

export default function Sidebar({ isOpen, onClose, user }: SidebarProps) {
  const location = useLocation();

  const isActive = (href: string) => {
    if (href === '/') {
      return location.pathname === '/';
    }
    return location.pathname.startsWith(href);
  };

  const allNavigation = user.role === 'admin' 
    ? [...navigation, ...adminNavigation]
    : navigation;

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-neutral-900 bg-opacity-50 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <div className={`
        fixed inset-y-0 left-0 z-50 w-64 bg-white shadow-lg transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-0
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between h-16 px-4 border-b border-neutral-200">
            <div className="flex items-center">
              <img
                className="h-8 w-8 rounded-lg"
                src="/Media/logo-ccrb.png"
                alt="CCR-B Logo"
              />
              <span className="ml-3 text-lg font-semibold text-neutral-900">
                CCR-B
              </span>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-md text-neutral-600 hover:text-primary-600 hover:bg-primary-50 lg:hidden"
            >
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-4 py-4 space-y-1 overflow-y-auto">
            {allNavigation.map((item) => (
              <Link
                key={item.name}
                to={item.href}
                onClick={onClose}
                className={`
                  sidebar-link group
                  ${isActive(item.href) ? 'sidebar-link-active' : ''}
                `}
              >
                <svg
                  className="flex-shrink-0 h-5 w-5 mr-3"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d={item.icon}
                  />
                </svg>
                {item.name}
              </Link>
            ))}
          </nav>

          {/* User info */}
          <div className="p-4 border-t border-neutral-200">
            <div className="flex items-center">
              <img
                className="h-10 w-10 rounded-full"
                src={user.avatar || '/Media/default-avatar.png'}
                alt={user.name}
              />
              <div className="ml-3">
                <p className="text-sm font-medium text-neutral-900">{user.name}</p>
                <p className="text-xs text-neutral-500 capitalize">{user.role}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
