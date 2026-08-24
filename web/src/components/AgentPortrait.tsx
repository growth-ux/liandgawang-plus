import type { Agent } from "../data/agents";

/** 详细页小二形象：主题色背光 + 轻量落地光，颜色由页面 --agent-accent 提供。 */
export default function AgentPortrait({ agent }: { agent: Agent }) {
  return (
    <span className="agent-theme-avatar-shell" aria-hidden="true">
      <span className="agent-theme-avatar-aura" />
      <span className="agent-theme-avatar-floor" />
      <img src={agent.image} alt="" className="agent-theme-avatar-image" />
    </span>
  );
}
