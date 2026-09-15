import { useState } from "react";
import { getAgent } from "../../data/agents";

/** 仅舞台使用独立粮掌柜 IP，不改变首页素材配置。 */
export default function IpPortrait({
  agentId,
  name,
}: {
  agentId: string;
  name: string;
}) {
  const [failed, setFailed] = useState(false);
  const profile = getAgent(agentId);
  const src = agentId === "da" ? "/images/agents/da.png" : profile?.image;
  return (
    <span
      className="zg-ip-portrait"
      data-agent-id={agentId}
      data-flip={profile?.flip || undefined}
    >
      <span className="zg-ip-pose">
        {!failed && src ? (
          <img
            src={src}
            alt={`${name}完整形象`}
            draggable={false}
            onError={() => setFailed(true)}
          />
        ) : (
          <span className="zg-ip-fallback">{name}</span>
        )}
      </span>
    </span>
  );
}
