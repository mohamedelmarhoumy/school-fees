import { Tajawal } from 'next/font/google';
import './globals.css';
import ServiceWorkerRegister from './service-worker-register';

const tajawal = Tajawal({
  subsets: ['arabic'],
  weight: ['400', '500', '700', '800'],
  display: 'swap',
});

export const metadata = {
  title: 'حصتي',
  description: 'تطبيق إدارة الطلاب والحضور والاشتراكات',
  manifest: '/manifest.json',
  icons: {
    icon: '/favicon.ico',
    apple: '/icons/icon-192.png',
  },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }) {
  return (
    <html lang="ar" dir="rtl">
      <head>
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="حصتي" />
        <meta name="theme-color" content="#f8fafc" />
        <script
          dangerouslySetInnerHTML={{
            __html: `try{
              var t = localStorage.getItem('hissati-theme') || 'light';
              document.documentElement.setAttribute('data-theme', t);
              var m = document.querySelector('meta[name="theme-color"]');
              if (m) m.setAttribute('content', t === 'dark' ? '#111827' : '#f8fafc');
            }catch(e){}`,
          }}
        />
      </head>
      <body className={tajawal.className}>
        <ServiceWorkerRegister />
        {children}
      </body>
    </html>
  );
}
