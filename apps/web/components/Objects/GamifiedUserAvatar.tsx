'use client';

import type { GamificationProfile } from '@services/gamification/gamification';
import { Avatar, AvatarFallback, AvatarImage } from '@components/ui/avatar';
import { useLHSession } from '@components/Contexts/LHSessionContext';
import { AVATAR_UNLOCKS, LevelIndicator } from './GamificationLevel';
import { getUserAvatarMediaDirectory } from '@services/media/media';
import { getUserByUsername } from '@services/users/users';
import { getUriWithOrg } from '@services/config/config';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { User } from 'lucide-react';
import { cn } from '@/lib/utils';

import UserProfilePopup from './UserProfilePopup';

export type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl';
export type AvatarVariant = 'default' | 'outline' | 'ghost';

interface GamifiedUserAvatarProps {
  size?: AvatarSize;
  variant?: AvatarVariant;
  avatar_url?: string;
  use_with_session?: boolean;
  predefined_avatar?: 'ai' | 'empty';
  showProfilePopup?: boolean;
  userId?: number;
  username?: string;
  className?: string;
  fallbackText?: string;

  // Gamification props
  showLevelIndicator?: boolean;
  showLevelBadge?: boolean;
  gamificationProfile?: GamificationProfile | null;
  levelIndicatorPosition?: 'top-right' | 'bottom-right' | 'bottom-center';
  showAvatarFrame?: boolean;
  showAvatarAccessories?: boolean;
}

const sizeVariants = {
  'xs': 'h-6 w-6 text-[10px]',
  'sm': 'h-8 w-8 text-xs',
  'md': 'h-10 w-10 text-sm',
  'lg': 'h-12 w-12 text-base',
  'xl': 'h-16 w-16 text-lg',
  '2xl': 'h-20 w-20 text-xl',
  '3xl': 'h-32 w-32 text-2xl',
};

const variantStyles = {
  default: 'border-2 border-background shadow-md',
  outline: 'border-2 border-border',
  ghost: 'border-0',
};

// Level indicator size variants
const levelIndicatorSizes = {
  'xs': 'h-3 w-3 text-[8px]',
  'sm': 'h-4 w-4 text-[10px]',
  'md': 'h-5 w-5 text-xs',
  'lg': 'h-6 w-6 text-sm',
  'xl': 'h-7 w-7 text-sm',
  '2xl': 'h-8 w-8 text-base',
  '3xl': 'h-10 w-10 text-lg',
};

const GamifiedUserAvatar = (props: GamifiedUserAvatarProps) => {
  const t = useTranslations('Components.UserAvatar');
  const session = useLHSession() as any;
  const params = useParams();
  const [userData, setUserData] = useState<any>(null);

  const {
    size = 'md',
    variant = 'default',
    avatar_url,
    predefined_avatar,
    showProfilePopup,
    userId,
    username,
    className,
    fallbackText,
    showLevelIndicator = false,
    showLevelBadge = false,
    gamificationProfile,
    levelIndicatorPosition = 'bottom-right',
    showAvatarFrame = false,
    showAvatarAccessories = false,
  } = props;

  useEffect(() => {
    const fetchUserByUsername = async () => {
      if (username) {
        try {
          const data = await getUserByUsername(username);
          setUserData(data);
        } catch (error) {
          console.error('Error fetching user by username:', error);
        }
      }
    };

    fetchUserByUsername();
  }, [username]);

  const isExternalUrl = (url: string): boolean => {
    return url.startsWith('http://') || url.startsWith('https://');
  };

  const extractExternalUrl = (url: string): string | null => {
    const matches = url.match(/avatars\/(https?:\/\/[^/]+.*$)/);
    if (matches?.[1]) {
      return matches[1];
    }
    return null;
  };

  const getAvatarUrl = (): string => {
    if (predefined_avatar) {
      const avatarType = predefined_avatar === 'ai' ? 'tou_emblem_light.webp' : 'empty_avatar.webp';
      return getUriWithOrg(params.orgslug as string, `/${avatarType}`);
    }

    if (avatar_url) {
      const extractedUrl = extractExternalUrl(avatar_url);
      if (extractedUrl) {
        return extractedUrl;
      }
      if (isExternalUrl(avatar_url)) {
        return avatar_url;
      }
      return avatar_url;
    }

    if (userData?.avatar_image) {
      const avatarUrl = userData.avatar_image;
      if (isExternalUrl(avatarUrl)) {
        return avatarUrl;
      }
      return getUserAvatarMediaDirectory(userData.user_uuid, avatarUrl);
    }

    if (username) {
      return getUriWithOrg(params.orgslug as string, '/empty_avatar.webp');
    }

    if (session?.data?.user?.avatar_image) {
      const avatarUrl = session.data.user.avatar_image;
      if (isExternalUrl(avatarUrl)) {
        return avatarUrl;
      }
      return getUserAvatarMediaDirectory(session.data.user.user_uuid, avatarUrl);
    }

    return getUriWithOrg(params.orgslug as string, '/empty_avatar.webp');
  };

  const getFallbackText = (): string => {
    if (fallbackText) return fallbackText;

    if (userData?.first_name && userData?.last_name) {
      return `${userData.first_name[0]}${userData.last_name[0]}`.toUpperCase();
    }

    if (username && username.length > 0) {
      return username.charAt(0).toUpperCase();
    }

    if (session?.data?.user?.first_name && session?.data?.user?.last_name) {
      return `${session.data.user.first_name[0]}${session.data.user.last_name[0]}`.toUpperCase();
    }

    if (userData?.username) {
      return userData.username[0].toUpperCase();
    }

    if (session?.data?.user?.username) {
      return session.data.user.username[0].toUpperCase();
    }

    return '?';
  };

  const getAvatarFrame = (): string | null => {
    if (!(showAvatarFrame && gamificationProfile)) return null;

    const level = gamificationProfile.current_level;
    const availableFrames = AVATAR_UNLOCKS.frames.filter((frame) => level >= frame.level);

    // Return the highest unlocked frame
    return availableFrames.length > 0 ? availableFrames[availableFrames.length - 1]!.color : null;
  };

  const getAvatarAccessory = (): string | null => {
    if (!(showAvatarAccessories && gamificationProfile)) return null;

    const level = gamificationProfile.current_level;
    const availableAccessories = AVATAR_UNLOCKS.accessories.filter((accessory) => level >= accessory.level);

    // Return the highest unlocked accessory
    return availableAccessories.length > 0 ? availableAccessories[availableAccessories.length - 1]!.icon : null;
  };

  const frameClass = getAvatarFrame();
  const accessoryIcon = getAvatarAccessory();

  const avatarElement = (
    <div className="relative inline-block">
      <Avatar
        className={cn(
          sizeVariants[size],
          variantStyles[variant],
          'bg-background',
          frameClass && `border-4 ${frameClass}`,
          className,
        )}
      >
        <AvatarImage
          src={getAvatarUrl()}
          alt={t('altText')}
          className="bg-background"
        />
        <AvatarFallback className="bg-muted text-muted-foreground">
          {predefined_avatar === 'ai' ? <User className="h-[60%] w-[60%]" /> : getFallbackText()}
        </AvatarFallback>
      </Avatar>

      {/* Avatar Accessory */}
      {accessoryIcon && <div className="absolute -top-1 -right-1 text-sm">{accessoryIcon}</div>}

      {/* Level Badge */}
      {showLevelBadge && gamificationProfile && (
        <div
          className={cn(
            'absolute flex items-center justify-center rounded-full bg-primary text-primary-foreground font-bold shadow-md',
            levelIndicatorSizes[size],
            {
              'top-0 right-0 translate-x-1/2 -translate-y-1/2': levelIndicatorPosition === 'top-right',
              'bottom-0 right-0 translate-x-1/2 translate-y-1/2': levelIndicatorPosition === 'bottom-right',
              'bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2': levelIndicatorPosition === 'bottom-center',
            },
          )}
        >
          {gamificationProfile.current_level}
        </div>
      )}

      {/* Level Indicator with Icon */}
      {showLevelIndicator && gamificationProfile && (
        <div
          className={cn('absolute flex items-center justify-center rounded-full shadow-md', levelIndicatorSizes[size], {
            'top-0 right-0 translate-x-1/2 -translate-y-1/2': levelIndicatorPosition === 'top-right',
            'bottom-0 right-0 translate-x-1/2 translate-y-1/2': levelIndicatorPosition === 'bottom-right',
            'bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2': levelIndicatorPosition === 'bottom-center',
          })}
        >
          <LevelIndicator
            profile={gamificationProfile}
            variant="badge"
            showXP={false}
            showProgress={false}
          />
        </div>
      )}
    </div>
  );

  if (showProfilePopup && (userId || userData?.id)) {
    return <UserProfilePopup userId={userId || userData?.id}>{avatarElement}</UserProfilePopup>;
  }

  return avatarElement;
};

export default GamifiedUserAvatar;
