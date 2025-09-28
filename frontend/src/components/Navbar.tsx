// import React from 'react';
import { User } from '../hooks/useAuth';

interface NavbarProps {
  onMenuClick: () => void;
  user: User;
  onSignOut: () => void;
}

export default function Navbar({ onMenuClick, user, onSignOut }: NavbarProps) {
  return (
    <nav className="navbar sticky top-0 z-40">
      <div className="px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Left side */}
          <div className="flex items-center">
            <button
              type="button"
              className="p-2 rounded-md text-neutral-600 hover:text-primary-600 hover:bg-primary-50 lg:hidden"
              onClick={onMenuClick}
            >
              <span className="sr-only">Open sidebar</span>
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            
            <div className="flex items-center ml-4 lg:ml-0">
              <img
                className="h-8 w-8 rounded-lg"
                src="/Media/logo-ccrb.png"
                alt="CCR-B Logo"
              />
              <h1 className="ml-3 text-xl font-bold text-neutral-900">
                Presence CCR-B
              </h1>
            </div>
          </div>

          {/* Right side */}
          <div className="flex items-center space-x-4">
            {/* Notifications */}
            <button
              type="button"
              className="p-2 rounded-lg text-neutral-600 hover:text-primary-600 hover:bg-primary-50 relative"
            >
              <span className="sr-only">View notifications</span>
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-5-5V7a5 5 0 00-10 0v5l-5 5h5m5 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
              <span className="absolute top-1 right-1 h-2 w-2 bg-accent-500 rounded-full"></span>
            </button>

            {/* User menu */}
            <div className="relative">
              <button
                type="button"
                className="flex items-center space-x-3 p-2 rounded-lg text-sm hover:bg-primary-50 focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <img
                  className="h-8 w-8 rounded-full"
                  src={user.avatar || '/Media/default-avatar.png'}
                  alt={user.name}
                />
                <div className="hidden md:block text-left">
                  <p className="font-medium text-neutral-900">{user.name}</p>
                  <p className="text-xs text-neutral-500 capitalize">{user.role}</p>
                </div>
                <svg className="h-4 w-4 text-neutral-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
            </div>

            {/* Sign out button */}
            <button
              onClick={onSignOut}
              className="btn btn-ghost text-sm"
            >
              <svg className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              Déconnexion
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}
