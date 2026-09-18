import { useId } from "react";

/** 无全息层的实体协作台：分层台面与橙青刻度。 */
export default function StageBackdrop() {
  const id = useId().replace(/:/g, "");
  return (
    <svg
      className="zg-stage-backdrop"
      viewBox="0 0 1040 720"
      aria-hidden="true"
    >
      <defs>
        <radialGradient id={`${id}-ambient`}>
          <stop stopColor="var(--color-brand)" stopOpacity=".15" />
          <stop offset="1" stopColor="var(--color-brand)" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`${id}-deck`} x2="0" y2="1">
          <stop stopColor="var(--stage-deck-top)" stopOpacity=".75" />
          <stop offset="1" stopColor="var(--stage-deck-bottom)" stopOpacity=".25" />
        </linearGradient>
      </defs>
      <ellipse
        className="zg-stage-ambient"
        cx="520"
        cy="410"
        rx="445"
        ry="265"
        fill={`url(#${id}-ambient)`}
      />
      <path
        d="M65 441A455 191 0 0 0 975 441V461A455 191 0 0 1 65 461Z"
        fill="var(--stage-deck-edge)"
        stroke="var(--color-brand)"
        strokeOpacity=".18"
      />
      <ellipse
        cx="520"
        cy="441"
        rx="455"
        ry="191"
        fill={`url(#${id}-deck)`}
        stroke="var(--color-brand)"
        strokeOpacity=".3"
      />
      <ellipse
        cx="520"
        cy="427"
        rx="460"
        ry="197"
        fill="none"
        stroke="var(--color-brand)"
        strokeOpacity=".18"
      />
      <ellipse
        cx="520"
        cy="413"
        rx="430"
        ry="184"
        fill="none"
        stroke="var(--color-brand)"
        strokeOpacity=".6"
        strokeWidth="1.3"
        strokeDasharray="85 18 3 12"
      />
      <ellipse
        cx="520"
        cy="424"
        rx="389"
        ry="162"
        fill="none"
        stroke="var(--color-tech)"
        strokeOpacity=".25"
        strokeDasharray="2 10"
      />
      <path
        d="M60 427A460 197 0 0 0 980 427"
        fill="none"
        stroke="var(--color-brand)"
        strokeWidth="2"
        opacity=".4"
      />
      {Array.from({ length: 96 }, (_, i) => {
        const a = (i / 96) * Math.PI * 2;
        const major = i % 4 === 0;
        return (
          <path
            key={i}
            d={`M${520 + 455 * Math.cos(a)} ${427 + 191 * Math.sin(a)}L${520 + (major ? 439 : 447) * Math.cos(a)} ${427 + (major ? 179 : 186) * Math.sin(a)}`}
            stroke={major ? "var(--color-brand)" : "var(--color-tech)"}
            strokeOpacity={major ? 0.65 : 0.28}
          />
        );
      })}
      {Array.from({ length: 32 }, (_, i) => (
        <circle
          key={i}
          cx={((i * 167 + 41) % 1000) + 20}
          cy={((i * 73 + 60) % 620) + 20}
          r={i % 3 === 0 ? 1 : 0.6}
          fill="var(--color-ink-soft)"
          opacity={0.08 + (i % 4) * 0.05}
        />
      ))}
    </svg>
  );
}

export type StageFeedback = "dispatch" | "return" | "conflict";

export function IpPedestal({
  central = false,
  feedback = {},
  continuousFlow = false,
}: {
  central?: boolean;
  feedback?: Record<string, StageFeedback>;
  continuousFlow?: boolean;
}) {
  return (
    <svg
      className={`zg-ip-pedestal${central ? " zg-ip-pedestal--central" : ""}`}
      viewBox="-110 -42 220 94"
      aria-hidden="true"
    >
      {/* 与首页脚底信标一致：淡外圈、虚线内圈和中心光点。 */}
      <ellipse
        className="zg-ip-beacon-outer"
        rx={central ? 72 : 48}
        ry={central ? 20 : 13}
        fill="none"
        stroke="currentColor"
        strokeOpacity=".3"
      />
      <ellipse
        className="zg-ip-base-ring"
        rx={central ? 42 : 28}
        ry={central ? 11.5 : 7.5}
        fill="none"
        stroke="currentColor"
        strokeOpacity=".75"
        strokeWidth="1"
        strokeDasharray="2 3"
      />
      <ellipse
        className="zg-ip-beacon-core"
        rx={central ? 4 : 3}
        ry={central ? 2.2 : 1.6}
        fill="currentColor"
      />
      {Object.entries(feedback).map(([id, kind]) => (
        <ellipse
          key={`${id}-${kind}`}
          className="zg-ip-feedback"
          data-feedback={kind}
          rx={central ? 60 : 40}
          ry={central ? 17 : 11}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        />
      ))}
      {continuousFlow && (
        <>
          <ellipse
            className="zg-ip-feedback zg-ip-feedback--cycle"
            data-feedback="dispatch"
            rx={central ? 60 : 40}
            ry={central ? 17 : 11}
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          />
          <ellipse
            className="zg-ip-feedback zg-ip-feedback--cycle"
            data-feedback="return"
            rx={central ? 60 : 40}
            ry={central ? 17 : 11}
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          />
        </>
      )}
    </svg>
  );
}
