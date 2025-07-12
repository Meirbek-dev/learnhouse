'use client';

import { HeaderProfileBox } from '@components/Security/HeaderProfileBox';
import { SearchBar } from '@components/Objects/Search/SearchBar';
import { OpenULogoSVG } from '@components/svg/openuLogoSvg';
import { getUriWithOrg } from '@services/config/config';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Menu, X } from 'lucide-react';
import * as React from 'react';
import Link from 'next/link';

import MenuLinks from './OrgMenuLinks';

export const OrgMenu = (props: any) => {
  const { orgslug } = props;
  const [_feedbackModal, setFeedbackModal] = React.useState(false);
  const [isMenuOpen, setIsMenuOpen] = React.useState(false);
  const [isFocusMode, setIsFocusMode] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    // Only check focus mode if we're in an activity page
    if (typeof window !== 'undefined' && pathname?.includes('/activity/')) {
      const saved = localStorage.getItem('globalFocusMode');
      setIsFocusMode(saved === 'true');
    } else {
      setIsFocusMode(false);
    }

    // Add storage event listener for cross-window changes
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'globalFocusMode' && pathname?.includes('/activity/')) {
        setIsFocusMode(e.newValue === 'true');
      }
    };

    // Add custom event listener for same-window changes
    const handleFocusModeChange = (e: CustomEvent) => {
      if (pathname?.includes('/activity/')) {
        setIsFocusMode(e.detail.isFocusMode);
      }
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('focusModeChange', handleFocusModeChange as EventListener);

    // Cleanup
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('focusModeChange', handleFocusModeChange as EventListener);
    };
  }, [pathname]);

  function closeFeedbackModal() {
    setFeedbackModal(false);
  }

  function toggleMenu() {
    setIsMenuOpen(!isMenuOpen);
  }

  // Only hide menu if we're in an activity page and focus mode is enabled
  if (pathname?.includes('/activity/') && isFocusMode) {
    return null;
  }

  return (
    <>
      <div className="-z-10 h-[60px] blur-3xl backdrop-blur-lg" />
      <div className="fixed left-0 right-0 top-0 z-50 h-[60px] bg-white/90 shadow-[0px_4px_16px_rgba(0,0,0,0.03)] ring-1 ring-inset ring-gray-500/10 backdrop-blur-lg">
        <div className="max-w-(--breakpoint-2xl) mx-auto flex h-full w-full items-center justify-between px-4 sm:px-6 lg:px-16">
          <div className="flex w-full items-center space-x-5 md:w-auto">
            <div className="logo flex w-full justify-center md:w-auto">
              <Link href={getUriWithOrg(orgslug, '/')}>
                <div className="m-auto flex h-auto w-auto items-center justify-center rounded-md">
                  <OpenULogoSVG />
                </div>
              </Link>
            </div>
            <div className="hidden md:flex">
              <MenuLinks orgslug={orgslug} />
            </div>
          </div>

          {/* Search Section */}
          <div className="hidden max-w-lg flex-1 justify-center px-4 md:flex">
            <SearchBar
              orgslug={orgslug}
              className="w-full"
            />
          </div>

          <div className="flex items-center space-x-4">
            <div className="hidden md:flex">
              <HeaderProfileBox />
            </div>
            <button
              className="focus:outline-hidden text-gray-600 md:hidden"
              onClick={toggleMenu}
            >
              {isMenuOpen ? <X color="black" /> : <Menu color="black" />}
            </button>
          </div>
        </div>
      </div>
      <div
        className={`fixed inset-x-0 z-40 bg-white/80 shadow-lg backdrop-blur-lg transition-all duration-300 ease-in-out md:hidden ${
          isMenuOpen ? 'top-[60px] opacity-100' : '-top-full opacity-0'
        }`}
      >
        <div className="flex flex-col items-center justify-center space-y-4 px-4 py-3">
          {/* Mobile Search */}
          <div className="w-full px-2">
            <SearchBar
              orgslug={orgslug}
              isMobile
            />
          </div>
          <div className="py-4">
            <MenuLinks orgslug={orgslug} />
          </div>
          <div className="border-t border-gray-200">
            <HeaderProfileBox />
          </div>
        </div>
      </div>
    </>
  );
};
