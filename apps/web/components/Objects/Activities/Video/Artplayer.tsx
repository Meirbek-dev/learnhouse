import type ArtplayerType from 'artplayer';
import Artplayer from 'artplayer';
import { useEffect, useRef } from 'react';

interface SubtitleEntry {
  html: string;
  url: string;
}

interface PlayerProps {
  option: any;
  getInstance?: (art: Artplayer) => void;
  subtitle?: any;
  subtitleEntries?: SubtitleEntry[];
  startTime?: number;
  endTime?: number | null;
  onPlayerReady?: (art: Artplayer) => void;
  [key: string]: any;
}
const captionsSVGString = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#000" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-captions-icon lucide-captions"><rect width="18" height="14" x="3" y="5" rx="2" ry="2" /><path d="M7 15h4M15 15h2M7 11h2M13 11h4" /></svg>`;

function getArtplayerLocale(locale: string) {
  // Only import the required language object
  try {
    return require('@/messages/Artplayer')[locale] || undefined;
  } catch {
    return;
  }
}

export default function ArtPlayer({
  option,
  getInstance,
  subtitle,
  locale = 'en',
  subtitleEntries = [],
  startTime,
  endTime,
  onPlayerReady,
  ...rest
}: PlayerProps) {
  const artRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const i18nLocale = getArtplayerLocale(locale);
    const art: ArtplayerType = new Artplayer({
      ...option,
      container: artRef.current,
      volume: 1,
      isLive: false,
      pip: option.pip,
      autoOrientation: true,
      autoSize: true,
      autoMini: true,
      screenshot: false,
      setting: true,
      loop: false,
      flip: false,
      playbackRate: true,
      aspectRatio: false,
      fullscreen: true,
      fullscreenWeb: false,
      hotkey: true,
      subtitleOffset: false,
      miniProgressBar: false,
      mutex: true,
      autoPlayback: true,
      airplay: true,
      theme: '#23ade5',
      i18n: i18nLocale ? { [locale]: i18nLocale } : {},
      settings: [
        {
          width: 200,
          html: 'Субтитры',
          icon: captionsSVGString,
          selector: [
            {
              html: 'Включить',
              switch: true,
              onSwitch: (item) => {
                art.subtitle.show = !item.switch;
                return !item.switch;
              },
            },
            ...subtitleEntries,
          ],
          onSelect: (item) => {
            art.subtitle.switch(item.url, {
              name: item.html,
            });
            return item.html;
          },
        },
      ],
      subtitle: subtitle || {
        url: `/subtitle.${locale}.srt`,
        type: 'srt',
        style: {
          color: '#ffffff',
          fontSize: '2.5rem',
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          textAlign: 'center',
        },
        encoding: 'utf8',
      },
    });

    if (getInstance && typeof getInstance === 'function') {
      getInstance(art);
    }

    art.on('ready', () => {
      if (startTime && art.duration >= startTime) {
        art.seek = startTime;
      }
      if (onPlayerReady) {
        onPlayerReady(art);
      }
    });

    if (endTime) {
      const handleTimeUpdate = () => {
        if (art.currentTime >= endTime) {
          art.pause();
          art.off('timeupdate' as any, handleTimeUpdate);
        }
      };
      art.on('timeupdate' as any, handleTimeUpdate);
    }

    return () => {
      if (art?.destroy) {
        art.destroy(false);
      }
    };
  }, []);

  return (
    <div
      ref={artRef}
      {...rest}
    />
  );
}
