import type { Agent } from "../data/agents";

export default function AgentAvatar({
  agent,
  size = 40,
  className = "",
}: {
  agent: Agent;
  size?: number;
  className?: string;
}) {
  return (
    <span
      className={`flex shrink-0 items-center justify-center rounded-full font-semibold text-white ${className}`}
      style={{
        width: size,
        height: size,
        fontSize: size * 0.42,
        background: `linear-gradient(135deg, ${agent.accent}, ${agent.accent}cc)`,
        boxShadow: `0 2px 8px ${agent.accent}55`,
      }}
    >
      {agent.char}
    </span>
  );
}
