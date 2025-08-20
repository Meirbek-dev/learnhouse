import WithMenuClientLayout from './with-menu-client-layout';
import '@styles/globals.css';

export default async function RootLayout(props: { children: React.ReactNode; params: Promise<any> }) {
  const params = await props.params;
  const { children } = props;

  return <WithMenuClientLayout orgslug={params?.orgslug}>{children}</WithMenuClientLayout>;
}
