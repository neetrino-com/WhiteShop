'use client';

import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export interface AdminMenuItem {
  id: string;
  label: string;
  path: string;
  icon: ReactNode;
  isSubCategory?: boolean;
}

interface AdminMenuDrawerProps {
  tabs: AdminMenuItem[];
  currentPath: string;
}

/**
 * Renders a mobile-friendly admin hamburger menu that mirrors the desktop sidebar.
 */
export function AdminMenuDrawer({ tabs, currentPath }: AdminMenuDrawerProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (open) {
      console.info('[AdminMenuDrawer] Locking body scroll for open drawer');
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }

    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  /**
   * Handles navigation button clicks inside the drawer.
   */
  const handleNavigate = (path: string) => {
    console.info('[AdminMenuDrawer] Navigating to admin path', { path });
    router.push(path);
    setOpen(false);
  };

  return (
    <div className="lg:hidden">
      <button
        type="button"
        onClick={() => {
          console.info('[AdminMenuDrawer] Toggling drawer', { open: !open });
          setOpen(true);
        }}
        className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-semibold uppercase tracking-wide text-gray-800 shadow-sm"
      >
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 6H20M4 12H16M4 18H12" />
        </svg>
        Menu
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex bg-black/40 backdrop-blur-sm"
          onClick={() => {
            console.info('[AdminMenuDrawer] Closing drawer from backdrop');
            setOpen(false);
          }}
        >
          <div
            className="h-full min-h-screen w-1/2 min-w-[16rem] max-w-full bg-white flex flex-col shadow-2xl"
            role="dialog"
            aria-modal="true"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
              <p className="text-lg font-semibold text-gray-900">Admin Navigation</p>
              <button
                type="button"
                onClick={() => {
                  console.info('[AdminMenuDrawer] Closing drawer from close button');
                  setOpen(false);
                }}
                className="h-10 w-10 rounded-full border border-gray-200 text-gray-600 hover:border-gray-300 hover:text-gray-900"
                aria-label="Close admin menu"
              >
                <svg className="mx-auto h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto divide-y divide-gray-100">
              {tabs.map((tab) => {
                const isActive =
                  currentPath === tab.path ||
                  (tab.path === '/admin' && currentPath === '/admin') ||
                  (tab.path !== '/admin' && currentPath.startsWith(tab.path));

                return (
                  <button
                    key={tab.id}
                    onClick={() => handleNavigate(tab.path)}
                    className={`flex w-full items-center justify-between px-4 py-3 text-left text-sm font-medium ${
                      tab.isSubCategory ? 'pl-8' : ''
                    } ${
                      isActive ? 'bg-gray-900 text-white' : 'text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <span className="flex items-center gap-3">
                      <span className={isActive ? 'text-white' : 'text-gray-500'}>{tab.icon}</span>
                      {tab.label}
                    </span>
                    <svg className={`w-4 h-4 ${isActive ? 'text-white' : 'text-gray-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


