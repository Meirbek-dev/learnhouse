import OrgClientProviders from './org-client-providers';
import Footer from '@components/Footer/Footer';
import '@styles/globals.css';

export default async function RootLayout(props: { children: React.ReactNode; params: Promise<any> }) {
  const params = await props.params;
  const { children } = props;

  return (
    <div>
      <OrgClientProviders orgslug={params.orgslug}>{children}</OrgClientProviders>
      <Footer />
    </div>
  );
}
