type GamePhase = 'guessing' | 'revealing';

interface GameOverlayProps {
  readonly cityName: string;
  readonly countdown: number | null;
  readonly phase: GamePhase;
  readonly nextCountdown: number | null;
  readonly distance: number | null;
  readonly visible: boolean;
}

export default function GameOverlay({
  cityName,
  countdown,
  phase,
  nextCountdown,
  distance,
  visible,
}: GameOverlayProps) {
  if (!visible) return null;

  return (
    <div className="pointer-events-none absolute inset-0 z-30 flex flex-col items-center justify-center">
      {phase === 'guessing' && (
        <p
          className="mb-2 text-lg text-white/90 drop-shadow-[0_2px_4px_rgba(0,0,0,0.6)] sm:text-2xl"
          style={{ fontFamily: 'var(--font-game)' }}
        >
          Point in the direction of...
        </p>
      )}
      <h1
        className="text-5xl text-white drop-shadow-[0_4px_8px_rgba(0,0,0,0.8)] sm:text-7xl"
        style={{ fontFamily: 'var(--font-game)' }}
      >
        {cityName}
      </h1>

      {/* Guessing phase: big countdown */}
      {phase === 'guessing' && countdown !== null && countdown > 0 && (
        <span
          className="mt-6 text-8xl text-white drop-shadow-[0_4px_8px_rgba(0,0,0,0.8)] sm:text-9xl"
          style={{ fontFamily: 'var(--font-game)' }}
        >
          {countdown}
        </span>
      )}

      {/* Revealing phase: animated distance */}
      {phase === 'revealing' && distance !== null && (
        <p
          className="mt-4 animate-fade-slide-up text-3xl text-white/90 drop-shadow-[0_2px_4px_rgba(0,0,0,0.6)] sm:text-4xl"
          style={{ fontFamily: 'var(--font-game)' }}
        >
          {distance.toLocaleString()} km
        </p>
      )}

      {/* Revealing phase: small "next location in..." message */}
      {phase === 'revealing' && nextCountdown !== null && nextCountdown > 0 && (
        <p
          className="mt-8 text-lg text-white/80 drop-shadow-[0_2px_4px_rgba(0,0,0,0.6)] sm:text-xl"
          style={{ fontFamily: 'var(--font-game)' }}
        >
          next location in {nextCountdown}...
        </p>
      )}
    </div>
  );
}
