import { ImageResponse } from 'next/og';

export const dynamic = 'force-static';

export const alt = 'Pointaloc — Point in the direction of cities around the world';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OGImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          background: 'linear-gradient(135deg, #1e3a5f 0%, #0f172a 100%)',
          padding: '60px',
        }}
      >
        {/* Arrow icon */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 260,
            height: 260,
            marginRight: 60,
            flexShrink: 0,
          }}
        >
          <svg viewBox="0 0 512 512" width="260" height="260">
            <circle cx="256" cy="256" r="190" fill="none" stroke="#60a5fa" strokeWidth="12" opacity="0.3" />
            <g transform="translate(256,256) rotate(-45)">
              <rect x="-18" y="-120" width="36" height="160" rx="8" fill="#3b82f6" />
              <polygon points="0,-210 -55,-110 0,-140 55,-110" fill="#60a5fa" />
              <polygon points="-30,40 0,20 30,40 0,70" fill="#2563eb" opacity="0.6" />
            </g>
            <circle cx="256" cy="256" r="12" fill="#f8fafc" />
          </svg>
        </div>
        {/* Text */}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div
            style={{
              fontSize: 88,
              fontWeight: 900,
              color: '#f8fafc',
              letterSpacing: 2,
              lineHeight: 1,
            }}
          >
            POINTALOC
          </div>
          <div
            style={{
              fontSize: 30,
              color: '#93c5fd',
              marginTop: 20,
              opacity: 0.85,
            }}
          >
            Point in the direction of cities around the world
          </div>
          <div
            style={{
              fontSize: 22,
              color: '#60a5fa',
              marginTop: 24,
              opacity: 0.5,
              fontFamily: 'monospace',
            }}
          >
            pointaloc.com
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
