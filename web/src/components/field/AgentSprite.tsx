/** 官方 IP 形象（自带透明通道的 RGBA PNG，无需抠图） */
export default function AgentSprite({
  className = "",
  alt = "",
}: {
  className?: string;
  alt?: string;
}) {
  return (
    <img
      src="/images/xiaoer-ip.png"
      className={className}
      alt={alt}
      draggable={false}
    />
  );
}
