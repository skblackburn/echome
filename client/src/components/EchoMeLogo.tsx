interface LogoProps {
  size?: number;
  className?: string;
}

export function EchoMeLogo({ size = 32, className = "" }: LogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      aria-label="EchoMe"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Concentric arcs — echo/ripple effect suggesting voice and memory */}
      {/* Outer ring — faintest */}
      <circle
        cx="16" cy="16" r="14"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeOpacity="0.25"
        fill="none"
      />
      {/* Middle ring */}
      <circle
        cx="16" cy="16" r="10"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeOpacity="0.5"
        fill="none"
      />
      {/* Inner ring */}
      <circle
        cx="16" cy="16" r="6"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeOpacity="0.75"
        fill="none"
      />
      {/* Center dot — the heart/soul */}
      <circle
        cx="16" cy="16" r="2.5"
        fill="currentColor"
      />
    </svg>
  );
}

export function EchoMeWordmark({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <EchoMeLogo size={28} />
      <span className="font-display font-semibold text-lg tracking-tight">
        EchoMe
      </span>
    </div>
  );
}
