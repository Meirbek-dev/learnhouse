'use client';
import Toast from '@components/Objects/StyledElements/Toast/Toast';
import { OrgProvider } from '@components/Contexts/OrgContext';
import Footer from '@components/Footer/Footer';

import NextTopLoader from 'nextjs-toploader';
import '@styles/globals.css';
import { use } from 'react';

export default function RootLayout(props: { children: React.ReactNode; params: Promise<any> }) {
  const params = use(props.params);
  const { children } = props;

  return (
    <div>
      <OrgProvider orgslug={params.orgslug}>
        <NextTopLoader
          color="#2b75ee"
          initialPosition={0.1}
          crawlSpeed={300}
          height={2}
          easing="ease"
          speed={1000}
          showSpinner={false}
          shadow="0 0 10px #2b75ee, 0 0 5px #2b75ee"
          crawl
        />
        <Toast />
        {children}
        <Footer />
      </OrgProvider>
    </div>
  );
}
