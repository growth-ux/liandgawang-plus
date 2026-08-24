const steps = [
  { num: "01", title: "描述目标", desc: "自然语言描述需求" },
  { num: "02", title: "AI 理解", desc: "智能分析并拆解" },
  { num: "03", title: "智能组队", desc: "选配专业小二" },
  { num: "04", title: "并行办理", desc: "多线同步推进" },
  { num: "05", title: "决策拍板", desc: "关键节点你来定", highlight: true },
];

/** 工作流程图：5步横向流程 */
export default function StartWorkflow() {
  return (
    <div className="zg-start-workflow">
      <div className="zg-start-section-header">
        <span className="zg-start-section-label">工作流程</span>
        <div className="zg-start-section-line" />
      </div>
      <div className="zg-start-workflow-steps">
        {steps.map((step, i) => (
          <div key={step.num} className="zg-start-workflow-item-wrap">
            <div className={`zg-start-workflow-step${step.highlight ? " zg-start-workflow-step--highlight" : ""}`}>
              <div className={`zg-start-step-num${step.highlight ? " zg-start-step-num--highlight" : ""}`}>{step.num}</div>
              <div className="zg-start-step-title">{step.title}</div>
              <div className="zg-start-step-desc">{step.desc}</div>
            </div>
            {i < steps.length - 1 && (
              <div className="zg-start-workflow-connector">
                <div className="zg-start-connector-line" />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
