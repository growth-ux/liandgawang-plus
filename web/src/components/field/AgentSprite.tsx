/** 小二专属 IP 形象（assets/generated 透明底 RGBA PNG，每人一图） */
export default function AgentSprite({
  src,
  className = "",
  alt = "",
}: {
  src: string;
  className?: string;
  alt?: string;
}) {
  return (
    <img
      src={src}
      className={className}
      alt={alt}
      draggable={false}
    />
  );
}
