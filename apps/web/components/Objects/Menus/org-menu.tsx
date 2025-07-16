'use client';

import AuthenticatedClientElement from '@/components/Security/AuthenticatedClientElement';
import { NavigationMenu, NavigationMenuList } from '@/components/ui/navigation-menu';
import { HeaderProfileBox } from '@/components/Security/HeaderProfileBox';
import { BookCopy, Menu, Signpost, SquareLibrary, X } from 'lucide-react';
import { LocaleSwitcher } from '@/components/Utils/LocaleSwitcher';
import { SearchBar } from '@/components/Objects/Search/SearchBar';
import { getUriWithOrg } from '@/services/config/config';
import { OpenULogoSVG } from '../../svg/openuLogoSvg';
import { Button } from '@/components/ui/button';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import Link from 'next/link';

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
        className={`hover:text-primary flex items-center gap-3 font-medium py-2 px-4 rounded-md transition-colors max-h-[36px] ${
          isActive ? 'text-primary bg-primary/15' : 'text-muted-foreground hover:text-foreground hover:bg-accent/60'
        }`}
      >
        <Icon
          size={20}
          className={`flex-shrink-0 ${isActive ? 'text-primary' : ''}`}
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

    // Scroll detection for header background
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
    }
    document.body.style.overflow = 'unset';
  }, [isMenuOpen]);

  // Hide menu in focus mode during activities
  if (pathname?.includes('/activity/') && isFocusMode) {
    return null;
  }

  return (
    <>
      {/* Backdrop blur */}
      <div className="fixed top-0 left-0 right-0 h-[52px] -z-10 bg-background/85 backdrop-blur-sm" />

      {/* Main header */}
      <header
        className={`fixed left-0 right-0 top-0 z-50 h-[52px] transition-colors shadow-sm border-b border-border/60 ${
          isScrolled ? 'bg-background/97' : 'bg-background/92'
        } backdrop-blur-sm`}
      >
        <div className="max-w-8xl mx-auto flex h-full w-full items-center justify-between px-4 sm:px-6 lg:px-10">
          {/* Left section */}
          <div className="flex items-center gap-8 md:gap-10">
            {/* Logo */}
            <Link
              href={getUriWithOrg(orgslug, '/')}
              className="flex items-center justify-center p-2 rounded-xl hover:bg-accent/60 transition-colors"
            >
              <OpenULogoSVG />
            </Link>

            {/* Desktop Navigation */}
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

          {/* Center - Search */}
          <div className="hidden md:flex flex-1 justify-center px-8 max-w-2xl">
            <div className="w-full max-w-lg">
              <SearchBar
                orgslug={orgslug}
                className="w-full"
              />
            </div>
          </div>

          {/* Right section */}
          <div className="flex items-center gap-4">
            <div className="hidden sm:flex">
              <LocaleSwitcher />
            </div>

            {/* Desktop profile */}
            <div className="hidden md:flex">
              <HeaderProfileBox />
            </div>

            {/* Mobile menu trigger */}
            <Button
              className={`md:hidden h-11 w-11 rounded-xl transition-colors ${
                isMenuOpen ? 'bg-accent' : 'hover:bg-accent/60'
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
                  className={`absolute inset-0 transition-opacity ${isMenuOpen ? 'opacity-0' : 'opacity-100'}`}
                />
                <X
                  size={22}
                  strokeWidth={2.5}
                  className={`absolute inset-0 transition-opacity ${isMenuOpen ? 'opacity-100' : 'opacity-0'}`}
                />
              </div>
            </Button>
          </div>
        </div>
      </header>

      {/* Mobile menu */}
      {isMenuOpen && (
        <div className="fixed inset-0 z-[60] md:hidden">
          {/* Overlay */}
          <div
            className="absolute inset-0 bg-black/20 backdrop-blur-sm"
            onClick={() => setIsMenuOpen(false)}
            role="button"
            tabIndex={-1}
            aria-label="Close menu overlay"
          />

          {/* Menu panel */}
          <div
            className="absolute left-0 right-0 bg-background/95 backdrop-blur-sm border-b border-border/60 shadow-lg"
            data-mobile-menu
            onClick={(e) => e.stopPropagation()}
            style={{
              maxHeight: 'calc(100vh - 52px)',
              overflowY: 'auto',
              overflowX: 'visible',
            }}
          >
            <div className="px-4 py-6 space-y-6">
              {/* Mobile Search */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 px-2">
                  <div className="w-1 h-4 bg-primary rounded-full" />
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    {t('search')}
                  </label>
                </div>
                <div>
                  <SearchBar
                    orgslug={orgslug}
                    isMobile
                    className="w-full"
                  />
                </div>
              </div>

              {/* Mobile Navigation */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 px-2">
                  <div className="w-1 h-4 bg-primary rounded-full" />
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    {t('navigation')}
                  </label>
                </div>
                <div className="bg-accent/20 rounded-xl p-3 border border-border/30">
                  <nav className="space-y-1">
                    <div className="space-y-1">
                      <div onClick={() => setIsMenuOpen(false)}>
                        <NavigationLinkItem
                          href="/courses"
                          type="courses"
                          orgslug={orgslug}
                        />
                      </div>
                      <div onClick={() => setIsMenuOpen(false)}>
                        <NavigationLinkItem
                          href="/collections"
                          type="collections"
                          orgslug={orgslug}
                        />
                      </div>
                      <AuthenticatedClientElement checkMethod="authentication">
                        <div onClick={() => setIsMenuOpen(false)}>
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

              {/* Mobile locale switcher */}
              <div className="sm:hidden space-y-3">
                <div className="flex items-center gap-2 px-2">
                  <div className="w-1 h-4 bg-primary rounded-full" />
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    {t('language')}
                  </label>
                </div>
                <div className="bg-accent/20 rounded-xl p-4 border border-border/30">
                  <div
                    className="min-h-[44px] flex items-center"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <LocaleSwitcher
                      className="w-full"
                      isMobile
                    />
                  </div>
                </div>
              </div>

              {/* Mobile profile */}
              <div className="border-t border-border/50 pt-6 space-y-3">
                <div className="flex items-center gap-2 px-2">
                  <div className="w-1 h-4 bg-primary rounded-full" />
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    {t('account')}
                  </label>
                </div>
                <div className="bg-accent/20 rounded-xl p-4 border border-border/30">
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
