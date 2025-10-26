'use client';

const ShinyText = ({ text, disabled = false, speed = 5, className = '' }: { text: string; disabled?: boolean; speed?: number; className?: string; }) => {
  const animationDuration = `${speed}s`;

  return (
    <span className={`inline-block ${className}`}>
      <span className={`shiny-text`} style={{ animationDuration }}>
        {text}
      </span>
    </span>
  );
};

export default ShinyText;
