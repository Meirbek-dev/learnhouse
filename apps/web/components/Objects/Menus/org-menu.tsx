'use client';

import { SearchBar } from '@/components/Objects/Search/SearchBar';
import AuthenticatedClientElement from '@/components/Security/AuthenticatedClientElement';
import { HeaderProfileBox } from '@/components/Security/HeaderProfileBox';
import { Button } from '@/components/ui/button';
import { NavigationMenu, NavigationMenuList } from '@/components/ui/navigation-menu';
import { LocaleSwitcher } from '@/components/Utils/LocaleSwitcher';
import { getUriWithOrg } from '@/services/config/config';
import { BookCopy, Menu, Signpost, SquareLibrary, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { OpenULogoSVG } from '../../svg/openuLogoSvg';

interface OrgMenuProps {
  orgslug: string;
}

interface NavigationLinkProps {
  href: string;
  type: 'courses' | 'collections' | 'trail';
  orgslug: string;
}

// Navigation link component with icon and label
function NavigationLinkItem({ href, type, orgslug }: NavigationLinkProps) {
  const t = useTranslations('Components.OrgMenuLinks');
  const pathname = usePathname();

  const linkConfig = {
    courses: { icon: BookCopy, label: t('courses') },
    collections: { icon: SquareLibrary, label: t('collections') },
    trail: { icon: Signpost, label: t('trail') },
  };

  const { icon: Icon, label } = linkConfig[type];
  const isActive = pathname.includes(href);

  return (
    <div>
      <Link
        href={getUriWithOrg(orgslug, href)}
        className={`group relative flex items-center gap-3 font-medium py-2 px-4 rounded-md transition-all duration-300 ease-out hover:scale-[1.02] active:scale-[0.98] touch-manipulation max-h-[36px] ${
          isActive
            ? 'text-primary bg-primary/15 shadow-sm ring-1 ring-primary/20'
            : 'text-muted-foreground hover:text-foreground hover:bg-accent/60'
        }`}
      >
        <Icon
          size={20}
          className={`flex-shrink-0 transition-all duration-300 group-hover:scale-110 ${
            isActive ? 'text-primary drop-shadow-sm' : 'group-hover:text-primary'
          }`}
        />
        <span className={`text-base font-medium whitespace-nowrap ${isActive ? 'font-semibold' : ''}`}>{label}</span>
      </Link>
    </div>
  );
}

export default function OrgMenu({ orgslug }: OrgMenuProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isFocusMode, setIsFocusMode] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const pathname = usePathname();
  const t = useTranslations('Components.OrgMenu');

  useEffect(() => {
    // Focus mode logic from original OrgMenu
    if (typeof window !== 'undefined' && pathname?.includes('/activity/')) {
      const saved = localStorage.getItem('globalFocusMode');
      setIsFocusMode(saved === 'true');
    } else {
      setIsFocusMode(false);
    }

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'globalFocusMode' && pathname?.includes('/activity/')) {
        setIsFocusMode(e.newValue === 'true');
      }
    };

    const handleFocusModeChange = (e: CustomEvent) => {
      if (pathname?.includes('/activity/')) {
        setIsFocusMode(e.detail.isFocusMode);
      }
    };

    // Scroll detection for header background with improved thresholds
    const handleScroll = () => {
      const scrollY = window.scrollY;
      setIsScrolled(scrollY > 20);
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('focusModeChange', handleFocusModeChange as EventListener);
    window.addEventListener('scroll', handleScroll);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('focusModeChange', handleFocusModeChange as EventListener);
      window.removeEventListener('scroll', handleScroll);
    };
  }, [pathname]);

  function toggleMenu() {
    setIsMenuOpen(!isMenuOpen);
  }

  // Close mobile menu when clicking outside or pressing escape
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsMenuOpen(false);
    };

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Element;
      // Only close if clicking outside the mobile menu and not on menu trigger or select dropdown
      if (
        isMenuOpen &&
        !target.closest('[data-mobile-menu]') &&
        !target.closest('[data-menu-trigger]') &&
        !target.closest('[data-radix-select-content]') &&
        !target.closest('[data-slot="select-content"]')
      ) {
        setIsMenuOpen(false);
      }
    };

    if (isMenuOpen) {
      document.addEventListener('keydown', handleEscape);
      // Use a small delay to prevent immediate closing when opening
      const timeoutId = setTimeout(() => {
        document.addEventListener('click', handleClickOutside);
      }, 100);
      document.body.style.overflow = 'hidden';

      return () => {
        clearTimeout(timeoutId);
        document.removeEventListener('keydown', handleEscape);
        document.removeEventListener('click', handleClickOutside);
        document.body.style.overflow = 'unset';
      };
    } else {
      document.body.style.overflow = 'unset';
    }
  }, [isMenuOpen]);

  // Hide menu in focus mode during activities
  if (pathname?.includes('/activity/') && isFocusMode) {
    return null;
  }

  return (
    <>
      {/* Backdrop blur with gradient */}
      <div className="fixed top-0 left-0 right-0 h-[52px] -z-10 bg-gradient-to-b from-background/85 via-background/70 to-transparent backdrop-blur-2xl" />

      {/* Main header */}
      <header
        className={`fixed left-0 right-0 top-0 z-50 h-[52px] transition-all duration-300 ease-out ${
          isScrolled
            ? 'bg-background/97 shadow-xl shadow-black/8 border-b border-border/60'
            : 'bg-background/92 shadow-md shadow-black/3'
        } backdrop-blur-2xl supports-[backdrop-filter]:bg-background/85`}
      >
        <div className="max-w-8xl mx-auto flex h-full w-full items-center justify-between px-4 sm:px-6 lg:px-10">
          {/* Left section - enhanced layout */}
          <div className="flex items-center gap-8 md:gap-10">
            {/* Logo - premium hover effect */}
            <Link
              href={getUriWithOrg(orgslug, '/')}
              className="group flex items-center justify-center p-2 rounded-xl hover:bg-accent/60 transition-all duration-300 hover:scale-105 active:scale-95"
            >
              <div className="transition-transform duration-300 group-hover:rotate-1">
                <OpenULogoSVG />
              </div>
            </Link>

            {/* Desktop Navigation - enhanced with better spacing */}
            <nav className="hidden md:flex">
              <NavigationMenu>
                <NavigationMenuList className="gap-1">
                  <NavigationLinkItem
                    href="/courses"
                    type="courses"
                    orgslug={orgslug}
                  />
                  <NavigationLinkItem
                    href="/collections"
                    type="collections"
                    orgslug={orgslug}
                  />
                  <AuthenticatedClientElement checkMethod="authentication">
                    <NavigationLinkItem
                      href="/trail"
                      type="trail"
                      orgslug={orgslug}
                    />
                  </AuthenticatedClientElement>
                </NavigationMenuList>
              </NavigationMenu>
            </nav>
          </div>

          {/* Center - Enhanced Search with better responsiveness */}
          <div className="hidden md:flex flex-1 justify-center px-8 max-w-2xl">
            <div className="w-full max-w-lg">
              <SearchBar
                orgslug={orgslug}
                className="w-full"
              />
            </div>
          </div>

          {/* Right section - enhanced with better spacing */}
          <div className="flex items-center gap-4">
            <div className="hidden sm:flex">
              <LocaleSwitcher />
            </div>

            {/* Desktop profile */}
            <div className="hidden md:flex">
              <HeaderProfileBox />
            </div>

            {/* Mobile menu trigger - enhanced animation */}
            <Button
              className={`md:hidden relative h-11 w-11 rounded-xl transition-all duration-300 touch-manipulation ${
                isMenuOpen ? 'bg-accent shadow-inner scale-95' : 'hover:bg-accent/60 hover:scale-105 active:scale-95'
              }`}
              variant="ghost"
              size="icon"
              onClick={toggleMenu}
              aria-label={isMenuOpen ? t('closeMenu') : t('openMenu')}
              aria-expanded={isMenuOpen}
              data-menu-trigger
            >
              <div className="relative w-6 h-6">
                <Menu
                  size={22}
                  strokeWidth={2.5}
                  className={`absolute inset-0 transition-all duration-300 ease-out ${
                    isMenuOpen ? 'rotate-90 opacity-0 scale-75' : 'rotate-0 opacity-100 scale-100'
                  }`}
                />
                <X
                  size={22}
                  strokeWidth={2.5}
                  className={`absolute inset-0 transition-all duration-300 ease-out ${
                    isMenuOpen ? 'rotate-0 opacity-100 scale-100' : 'rotate-90 opacity-0 scale-75'
                  }`}
                />
              </div>
            </Button>
          </div>
        </div>
      </header>

      {/* Enhanced Mobile menu with glassmorphism design */}
      {isMenuOpen && (
        <div className="fixed inset-0 z-[60] md:hidden">
          {/* Animated overlay */}
          <div
            className={`absolute inset-0 bg-gradient-to-b from-black/30 via-black/20 to-black/30 backdrop-blur-md transition-all duration-500 ${
              isMenuOpen ? 'opacity-100' : 'opacity-0'
            }`}
            onClick={() => setIsMenuOpen(false)}
            role="button"
            tabIndex={-1}
            aria-label="Close menu overlay"
          />

          {/* Menu panel with enhanced glassmorphism */}
          <div
            className={`absolute left-0 right-0 bg-gradient-to-b from-background/98 to-background/95 backdrop-blur-2xl border-b border-border/60 shadow-2xl transition-all duration-500 ease-out ${
              isMenuOpen ? 'translate-y-0 opacity-100' : '-translate-y-full opacity-0'
            }`}
            data-mobile-menu
            onClick={(e) => e.stopPropagation()}
            style={{
              maxHeight: 'calc(100vh - 52px)',
              overflowY: 'auto',
              overflowX: 'visible',
            }}
          >
            <div className="px-4 py-6 space-y-6">
              {/* Mobile Search - premium styling */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 px-2">
                  <div className="w-1 h-4 bg-primary rounded-full"></div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    {t('search')}
                  </label>
                </div>
                <div className="touch-manipulation">
                  <SearchBar
                    orgslug={orgslug}
                    isMobile
                    className="w-full"
                  />
                </div>
              </div>

              {/* Mobile Navigation - enhanced with cards */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 px-2">
                  <div className="w-1 h-4 bg-primary rounded-full"></div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    {t('navigation')}
                  </label>
                </div>
                <div className="bg-accent/30 rounded-2xl p-3 backdrop-blur-sm border border-border/30">
                  <nav className="space-y-1">
                    <div className="space-y-1">
                      <div
                        onClick={() => setIsMenuOpen(false)}
                        className="touch-manipulation"
                      >
                        <NavigationLinkItem
                          href="/courses"
                          type="courses"
                          orgslug={orgslug}
                        />
                      </div>
                      <div
                        onClick={() => setIsMenuOpen(false)}
                        className="touch-manipulation"
                      >
                        <NavigationLinkItem
                          href="/collections"
                          type="collections"
                          orgslug={orgslug}
                        />
                      </div>
                      <AuthenticatedClientElement checkMethod="authentication">
                        <div
                          onClick={() => setIsMenuOpen(false)}
                          className="touch-manipulation"
                        >
                          <NavigationLinkItem
                            href="/trail"
                            type="trail"
                            orgslug={orgslug}
                          />
                        </div>
                      </AuthenticatedClientElement>
                    </div>
                  </nav>
                </div>
              </div>

              {/* Mobile locale switcher - Fixed positioning and z-index */}
              <div className="sm:hidden space-y-3">
                <div className="flex items-center gap-2 px-2">
                  <div className="w-1 h-4 bg-primary rounded-full"></div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    {t('language')}
                  </label>
                </div>
                <div className="bg-accent/30 rounded-2xl p-4 backdrop-blur-sm border border-border/30 touch-manipulation relative">
                  <div
                    className="min-h-[44px] flex items-center relative z-[70]"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <LocaleSwitcher
                      className="w-full"
                      isMobile
                    />
                  </div>
                </div>
              </div>

              {/* Mobile profile - premium card design */}
              <div className="border-t border-border/50 pt-6 space-y-3">
                <div className="flex items-center gap-2 px-2">
                  <div className="w-1 h-4 bg-primary rounded-full"></div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    {t('account')}
                  </label>
                </div>
                <div className="bg-accent/30 rounded-2xl p-4 backdrop-blur-sm border border-border/30 touch-manipulation">
                  <div className="min-h-[44px] flex justify-center items-center">
                    <HeaderProfileBox />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
