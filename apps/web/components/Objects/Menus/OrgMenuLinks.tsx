import AuthenticatedClientElement from '@components/Security/AuthenticatedClientElement';
import { BookCopy, Signpost, SquareLibrary } from 'lucide-react';
import { getUriWithOrg } from '@services/config/config';
import { useTranslations } from 'next-intl';
import Link from 'next/link';

function MenuLinks(props: { orgslug: string }) {
  return (
    <div className="pl-1">
      <ul className="flex space-x-5">
        <LinkItem
          link="/courses"
          type="courses"
          orgslug={props.orgslug}
        />
        <LinkItem
          link="/collections"
          type="collections"
          orgslug={props.orgslug}
        />
        <AuthenticatedClientElement checkMethod="authentication">
          <LinkItem
            link="/trail"
            type="trail"
            orgslug={props.orgslug}
          />
        </AuthenticatedClientElement>
      </ul>
    </div>
  );
}
const LinkItem = (props: any) => {
  const t = useTranslations('Components.OrgMenuLinks');
  const link = props.link;
  const orgslug = props.orgslug;
  return (
    <Link href={getUriWithOrg(orgslug, link)}>
      <li className="flex items-center space-x-2 font-medium text-[#909192]">
        {props.type === 'courses' && (
          <>
            <BookCopy size={20} /> <span>{t('courses')}</span>
          </>
        )}

        {props.type === 'collections' && (
          <>
            <SquareLibrary size={20} /> <span>{t('collections')}</span>
          </>
        )}

        {props.type === 'trail' && (
          <>
            <Signpost size={20} /> <span>{t('trail')}</span>
          </>
        )}
      </li>
    </Link>
  );
};
export default MenuLinks;
