interface GameCodeBadgeProps {
  code: string;
  connected: boolean;
}

export default function GameCodeBadge({ code, connected }: GameCodeBadgeProps) {
  return (
    <span className="gc-badge">
      <span className={`gc-dot ${connected ? 'gc-dot-on' : 'gc-dot-off'}`} />
      {code}
    </span>
  );
}
