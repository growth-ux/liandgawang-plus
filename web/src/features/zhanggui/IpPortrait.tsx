import { useState } from "react";
import { getAgent } from "../../data/agents";

/** 与首页、各小二独立页面共用同一套 IP 形象。 */
export default function IpPortrait({
  agentId,
  name,
  image,
}: {
  agentId: string;
  name: string;
  image?: string;
}) {
  const [failed, setFailed] = useState(false);
  const profile = getAgent(agentId);
  const src = image ?? profile?.image;
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
