'use client';
import Toast from '@components/Objects/StyledElements/Toast/Toast';
import { OrgProvider } from '@components/Contexts/OrgContext';
import Footer from '@components/Footer/Footer';

import '@styles/globals.css';
import { use } from 'react';

export default function RootLayout(props: { children: React.ReactNode; params: Promise<any> }) {
  const params = use(props.params);

  const { children } = props;

  return (
    <div>
      <OrgProvider orgslug={params.orgslug}>
        <Toast />
        {/* <Onboarding /> */}
        {children}
        <Footer />
      </OrgProvider>
    </div>
  );
}
