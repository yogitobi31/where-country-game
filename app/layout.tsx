import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : 'http://localhost:3000',
  ),
  title: '어디나라? | 세계지도 위치 게임',
  description: '지도를 클릭하며 전 세계 나라의 위치를 재미있게 익히는 지리 학습 게임',
  openGraph: {
    title: '어디나라? | 세계지도 위치 게임',
    description: '나라 이름을 보고 세계지도에서 위치를 찾아보세요. 틀린 나라는 자동으로 복습해요!',
    type: 'website',
    locale: 'ko_KR',
    images: [{ url: '/og.png', width: 1200, height: 630, alt: '어디나라? 세계지도 위치 게임' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: '어디나라? | 세계지도 위치 게임',
    description: '지도를 클릭하며 전 세계 나라의 위치를 재미있게 익혀요.',
    images: ['/og.png'],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
