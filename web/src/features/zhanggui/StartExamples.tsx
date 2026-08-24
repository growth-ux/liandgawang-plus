const examples = [
  {
    title: "玉米补库采购",
    tag: "常规",
    desc: "未来15天采购200吨二等玉米到潍坊，预算 ≤ 2680 元/吨",
    text: "未来15天采购200吨二等玉米到潍坊，预算不超过2680元/吨，不能影响生产",
  },
  {
    title: "大豆紧急采购",
    tag: "紧急",
    desc: "3天内采购50吨进口大豆到日照港，优先低价货源",
    text: "3天内紧急采购50吨进口大豆到日照港，优先选择低价货源，品质达标即可",
  },
  {
    title: "小麦框架协议",
    tag: "长期",
    desc: "签订下季度500吨小麦框架协议，锁定价格区间",
    text: "签订下季度500吨小麦长期供应框架协议，需要锁定合理价格区间，保障稳定供货",
  },
];

interface StartExamplesProps {
  onSelect(text: string): void;
}

/** 示例目标卡片：3个预设采购场景 */
export default function StartExamples({ onSelect }: StartExamplesProps) {
  return (
    <div className="zg-start-examples">
      <div className="zg-start-section-header">
        <span className="zg-start-section-label">场景示例</span>
        <div className="zg-start-section-line" />
      </div>
      <div className="zg-start-example-grid">
        {examples.map((ex) => (
          <button
            key={ex.title}
            type="button"
            onClick={() => onSelect(ex.text)}
            className="zg-start-example-card"
          >
            <div className="zg-start-example-title">
              {ex.title}
              <span className="zg-start-example-tag">{ex.tag}</span>
            </div>
            <div className="zg-start-example-desc">{ex.desc}</div>
          </button>
        ))}
      </div>
    </div>
  );
}
