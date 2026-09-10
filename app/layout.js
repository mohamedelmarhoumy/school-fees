import './globals.css';
import ServiceWorkerRegister from './service-worker-register';

export const metadata = {
  title: 'سجل المدرسة',
  description: 'تطبيق إدارة الطلاب والحضور والاشتراكات',
  manifest: '/manifest.json',
};

export const viewport = {
  themeColor: '#2563eb',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }) {
  return (
    <html lang="ar" dir="rtl">
      <head>
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="سجل المدرسة" />
      </head>
      <body>
        <ServiceWorkerRegister />
        {children}
      </body>
    </html>
  );
}
