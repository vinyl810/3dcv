import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Daewon Kim — Interactive 3D CV',
  description:
    'An interactive pixel-art 3D résumé of Daewon Kim: web graphics engineer and HCI / cognitive-AI researcher at KAIST.',
  authors: [{ name: 'Daewon Kim' }],
  openGraph: {
    title: 'Daewon Kim — Interactive 3D CV',
    description:
      'Explore a pixel-art diorama of my work in web graphics, the ocean, the brain, and AI.',
    type: 'website',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: '#1a2238',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
