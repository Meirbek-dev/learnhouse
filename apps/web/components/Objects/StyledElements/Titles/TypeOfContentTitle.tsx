import Image from 'next/image'
import CoursesLogo from 'public/svg/courses.svg'
import CollectionsLogo from 'public/svg/collections.svg'
import TrailLogo from 'public/svg/trail.svg'
import { getTranslations } from 'next-intl/server'

async function TypeOfContentTitle(props: { title: string; type: string }) {
  const t = await getTranslations('Components.TypeOfContentTitle')

  function getLogo() {
    if (props.type == 'col') {
      return CollectionsLogo
    } else if (props.type == 'cou') {
      return CoursesLogo
    } else if (props.type == 'tra') {
      return TrailLogo
    }
  }

  let logoAltType = 'unknown'
  if (props.type === 'col') logoAltType = 'collection'
  else if (props.type === 'cou') logoAltType = 'course'
  else if (props.type === 'tra') logoAltType = 'trail'
  const logoAlt = t('logoAlt', { type: logoAltType })

  return (
    <div className="home_category_title flex my-5 items-center">
      <div className="ml-2 rounded-full ring-1 ring-slate-900/5 shadow-inner p-2 my-auto mr-4">
        <Image unoptimized className="" src={getLogo()} alt={logoAlt} />
      </div>
      <h1 className="font-bold text-2xl">{props.title}</h1>
    </div>
  )
}

export default TypeOfContentTitle
