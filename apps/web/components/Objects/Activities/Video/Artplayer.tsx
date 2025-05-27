import { useEffect, useRef, RefObject } from 'react'
import Artplayer from 'artplayer'

interface PlayerProps {
  option: any
  getInstance?: (art: any) => void
  [key: string]: any
}

export default function ARTPlayer({
  option,
  getInstance,
  ...rest
}: PlayerProps) {
  const artRef = useRef<HTMLDivElement>(null)

  const captionsSVGString = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#000" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-captions-icon lucide-captions"><rect width="18" height="14" x="3" y="5" rx="2" ry="2" /><path d="M7 15h4M15 15h2M7 11h2M13 11h4" /></svg>`

  useEffect(() => {
    const art = new Artplayer({
      ...option,
      container: artRef.current,
      volume: 1,
      isLive: false,
      muted: false,
      autoplay: false,
      pip: true,
      autoSize: false,
      // autoMini: true,
      screenshot: false,
      setting: true,
      loop: false,
      flip: false,
      playbackRate: true,
      aspectRatio: false,
      fullscreen: true,
      fullscreenWeb: false,
      subtitleOffset: false,
      // miniProgressBar: true,
      // mutex: true,
      // backdrop: true,
      // playsInline: false,
      autoPlayback: true,
      // airplay: true,
      theme: '#23ade5',
      // lang: navigator.language.toLowerCase(),
      // moreVideoAttr: {
      //   crossOrigin: 'anonymous',
      // },
      settings: [
        {
          width: 200,
          html: 'Subtitle',
          tooltip: 'Russian',
          icon: captionsSVGString,
          selector: [
            {
              html: 'Display',
              tooltip: 'Show',
              switch: true,
              onSwitch: function (item) {
                item.tooltip = item.switch ? 'Hide' : 'Show'
                art.subtitle.show = !item.switch
                return !item.switch
              },
            },
            {
              default: true,
              html: 'Russian',
              url: '/assets/sample/subtitle.ru.srt',
            },
            {
              html: 'Kazakh',
              url: '/assets/sample/subtitle.kz.srt',
            },
          ],
          onSelect: function (item) {
            art.subtitle.switch(item.url, {
              name: item.html,
            })
            return item.html
          },
        },
      ],
      // quality: [
      //   {
      //     html: 'SD 480P',
      //     url: '/assets/sample/video.mp4?q=480',
      //   },
      //   {
      //     default: true,
      //     html: 'HD 720P',
      //     url: '/assets/sample/video.mp4?q=720',
      //   },
      // ],
      subtitle: {
        url: '/assets/sample/subtitle.srt',
        type: 'srt',
        style: {
          color: '#ffffff',
          fontSize: '20px',
          backgroundColor: '#000000',
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
