'use client';

import dynamic from 'next/dynamic';

const Map = dynamic(() => import('@/components/Map'), {
  ssr: false,
  loading: () => (
    <div className="flex h-screen w-screen items-center justify-center bg-zinc-100">
      <p className="text-zinc-500">Loading map…</p>
    </div>
  ),
});

export default function Home() {
  return <Map />;
}
