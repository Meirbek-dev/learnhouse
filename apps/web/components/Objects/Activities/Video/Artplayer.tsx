import { useEffect, useRef } from 'react'
import Artplayer from 'artplayer'
import { es, fr, id, kz, ru, tr } from '@/i18n/Artplayer'

interface SubtitleEntry {
  html: string
  url: string
}

interface PlayerProps {
  option: any
  getInstance?: (art: any) => void
  subtitle?: any // new prop for subtitle config
  [key: string]: any
}
const captionsSVGString = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#000" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-captions-icon lucide-captions"><rect width="18" height="14" x="3" y="5" rx="2" ry="2" /><path d="M7 15h4M15 15h2M7 11h2M13 11h4" /></svg>`

export default function ARTPlayer({
  option,
  getInstance,
  subtitle,
  locale,
  ...rest
}: PlayerProps) {
  const artRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const art = new Artplayer({
      ...option,
      container: artRef.current,
      volume: 1,
      isLive: false,
      pip: false,
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
      i18n: {
        ru: ru,
        es: es,
        fr: fr,
        id: id,
        kz: kz,
        tr: tr,
      },
      settings: [
        {
          width: 200,
          html: 'Subtitles',
          icon: captionsSVGString,
          selector: [
            {
              html: 'Display',
              switch: true,
              onSwitch: (item) => {
                art.subtitle.show = !item.switch
                return !item.switch
              },
            },
            {
              html: 'Russian',
              url: '/subtitle.ru.srt',
            },
            {
              html: 'English',
              url: '/subtitle.en.srt',
            },
            {
              html: 'Kazakh',
              url: '/subtitle.kz.srt',
            },
          ],
          onSelect: (item) => {
            art.subtitle.switch(item.url, {
              name: item.html,
            })
            return item.html
          },
        },
      ],
      subtitle: subtitle || {
        url: `/subtitle.${locale}.srt`,
        type: 'srt',
        style: {
          color: '#ffffff',
          fontSize: '20px',
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          textAlign: 'center',
        },
        encoding: 'utf-8',
      },
    })

    if (getInstance && typeof getInstance === 'function') {
      getInstance(art)
    }

    return () => {
      if (art && art.destroy) {
        art.destroy(false)
      }
    }
  }, [])

  return <div ref={artRef} {...rest}></div>
}
