`use client`;
import { useMemo } from 'react';

const ValorantRay = ({ delay, duration, rotation }: { delay: string; duration: string, rotation: number }) => {
  const style = {
    animationDelay: delay,
    animationDuration: duration,
    transform: `rotate(${rotation}deg)`,
  };

  return <div className="valorant-ray" style={style}></div>;
};

export function ValorantBackground() {
  const rays = useMemo(() => Array.from({ length: 30 }).map((_, i) => ({
    delay: `${Math.random() * 5}s`,
    duration: `${Math.random() * 5 + 5}s`,
    rotation: Math.random() * 360,
  })), []);

  return (
    <>
      <style jsx>{`
        .background-container {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background-color: hsl(var(--background));
          overflow: hidden;
          z-index: 0;
        }
        .background-container::after {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: radial-gradient(circle at center, transparent, hsl(var(--background)) 70%);
        }
        .valorant-ray {
          position: absolute;
          bottom: -100%;
          left: 50%;
          width: 2px;
          height: 200%;
          background: linear-gradient(to top, transparent, hsl(var(--primary) / 0.5), transparent);
          transform-origin: bottom center;
          animation-name: ray-anim;
          animation-timing-function: linear;
          animation-iteration-count: infinite;
          opacity: 0;
        }

        @keyframes ray-anim {
          0% {
            opacity: 0;
            transform: rotate(var(--rotation)) scaleY(0);
          }
          50% {
            opacity: 0.5;
          }
          100% {
            opacity: 0;
            transform: rotate(var(--rotation)) scaleY(1);
          }
        }
      `}</style>
      <div className="background-container">
        {rays.map((ray, i) => (
          <ValorantRay key={i} delay={ray.delay} duration={ray.duration} rotation={ray.rotation} />
        ))}
      </div>
    </>
  );
}
