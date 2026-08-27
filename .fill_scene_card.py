# -*- coding: utf-8 -*-
"""基于竞赛模板样式，重写 粮达e销-智能体场景卡-v3.docx 正文内容。"""
from docx import Document
from docx.oxml import parse_xml
from docx.oxml.ns import qn, nsdecls
from docx.text.paragraph import Paragraph

PATH = "/Users/tiger/Documents/汇报材料和ppt/贸易AI竞赛/粮达e销-智能体场景卡-v3.docx"
NS = nsdecls("w")
FONT = "微软雅黑"

doc = Document(PATH)

# ---------- 清空正文（保留 sectPr） ----------
body = doc.element.body
sectPr = body.find(qn("w:sectPr"))
for child in list(body):
    if child is not sectPr:
        body.remove(child)


def rpr(bold=False, size=24, color=None):
    b = "<w:b/><w:bCs/>" if bold else ""
    c = f'<w:color w:val="{color}"/>' if color else ""
    return (
        f'<w:rPr {NS}><w:rFonts w:hint="eastAsia" w:ascii="{FONT}" '
        f'w:hAnsi="{FONT}" w:eastAsia="{FONT}"/>{b}{c}'
        f'<w:sz w:val="{size}"/><w:szCs w:val="{size}"/></w:rPr>'
    )


def add_runs(p, segments, size=24):
    for text, bold in segments:
        r_xml = f'<w:r {NS}>{rpr(bold, size)}<w:t xml:space="preserve">{text}</w:t></w:r>'
        p._p.append(parse_xml(r_xml))


def new_para(ppr_xml):
    p_el = parse_xml(f'<w:p {NS}>{ppr_xml}</w:p>')
    body.insert(list(body).index(sectPr), p_el)
    return Paragraph(p_el, doc)


BODY_PPR = (
    f'<w:pPr {NS}><w:spacing w:before="60" w:after="60" w:line="400" w:lineRule="exact"/>'
    '<w:ind w:firstLine="480" w:firstLineChars="200"/><w:jc w:val="both"/></w:pPr>'
)
LEAD_PPR = (
    f'<w:pPr {NS}><w:spacing w:before="80" w:after="60" w:line="400" w:lineRule="exact"/>'
    '<w:jc w:val="both"/></w:pPr>'
)
BULLET_PPR = (
    f'<w:pPr {NS}><w:pStyle w:val="6"/>'
    '<w:numPr><w:ilvl w:val="0"/><w:numId w:val="2"/></w:numPr>'
    '<w:spacing w:before="40" w:after="40" w:line="400" w:lineRule="exact"/>'
    '<w:jc w:val="both"/></w:pPr>'
)
H1_PPR = f'<w:pPr {NS}><w:pStyle w:val="2"/><w:spacing w:before="240" w:after="120"/></w:pPr>'
H2_PPR = f'<w:pPr {NS}><w:pStyle w:val="3"/><w:spacing w:before="160" w:after="80"/></w:pPr>'
TITLE_PPR = (
    f'<w:pPr {NS}><w:spacing w:before="120" w:after="240" w:line="400" w:lineRule="exact"/>'
    '<w:jc w:val="center"/></w:pPr>'
)
NOTE_PPR = f'<w:pPr {NS}><w:spacing w:before="0" w:after="60"/></w:pPr>'


def heading1(text):
    add_runs(new_para(H1_PPR), [(text, True)])


def heading2(text):
    add_runs(new_para(H2_PPR), [(text, True)])


def body(text):
    add_runs(new_para(BODY_PPR), [(text, False)])


def bullet(text):
    p = new_para(BULLET_PPR)
    if "：" in text:
        lead, rest = text.split("：", 1)
        add_runs(p, [(lead + "：", True), (rest, False)])
    else:
        add_runs(p, [(text, False)])


def cell_ppr():
    return parse_xml(
        f'<w:pPr {NS}><w:spacing w:before="40" w:after="40" w:line="380" '
        'w:lineRule="exact"/><w:jc w:val="left"/></w:pPr>'
    )


def build_table(rows_data, header_row=False, col_widths=(2023, 6377)):
    tbl = doc.add_table(rows=0, cols=2)
    tbl_el = tbl._tbl
    tbl_el.remove(tbl_el.find(qn("w:tblPr")))
    tblPr = parse_xml(
        f'<w:tblPr {NS}><w:tblW w:w="8400" w:type="dxa"/><w:tblInd w:w="0" w:type="dxa"/>'
        '<w:tblBorders>'
        '<w:top w:val="single" w:color="BFCFCB" w:sz="4" w:space="0"/>'
        '<w:left w:val="single" w:color="BFCFCB" w:sz="4" w:space="0"/>'
        '<w:bottom w:val="single" w:color="BFCFCB" w:sz="4" w:space="0"/>'
        '<w:right w:val="single" w:color="BFCFCB" w:sz="4" w:space="0"/>'
        '<w:insideH w:val="single" w:color="BFCFCB" w:sz="4" w:space="0"/>'
        '<w:insideV w:val="single" w:color="BFCFCB" w:sz="4" w:space="0"/>'
        '</w:tblBorders><w:tblLayout w:type="fixed"/>'
        '<w:tblCellMar><w:top w:w="80" w:type="dxa"/><w:left w:w="150" w:type="dxa"/>'
        '<w:bottom w:w="80" w:type="dxa"/><w:right w:w="150" w:type="dxa"/></w:tblCellMar>'
        '</w:tblPr>'
    )
    tbl_el.insert(0, tblPr)
    old_grid = tbl_el.find(qn("w:tblGrid"))
    tbl_el.remove(old_grid)
    grid = parse_xml(
        f'<w:tblGrid {NS}>'
        + "".join(f'<w:gridCol w:w="{w}"/>' for w in col_widths)
        + "</w:tblGrid>"
    )
    tbl_el.insert(1, grid)

    for r_idx, (c0, c1) in enumerate(rows_data):
        tr = tbl.add_row()
        shade = header_row or r_idx >= 0  # 首列与表头着色
        for c_idx, text in enumerate([c0, c1]):
            cell = tr.cells[c_idx]
            tc = cell._tc
            fill = 'EEF3F2' if (header_row or c_idx == 0) else None
            shd = f'<w:shd w:val="clear" w:color="auto" w:fill="{fill}"/>' if fill else ""
            tc.insert(
                0,
                parse_xml(
                    f'<w:tcPr {NS}><w:tcW w:w="{col_widths[c_idx]}" w:type="dxa"/>'
                    f'{shd}<w:vAlign w:val="center"/></w:tcPr>'
                ),
            )
            p = cell.paragraphs[0]
            p._p.insert(0, cell_ppr())
            bold = header_row or c_idx == 0
            add_runs(p, [(text, bold)], size=24)
    # 将表格移动到 sectPr 之前（add_table 已处理，这里无需操作）
    return tbl


# ================= 文档内容 =================
add_runs(new_para(NOTE_PPR), [("附件", False)])
add_runs(new_para(TITLE_PPR), [("智能体搭建场景卡", True)], size=44)

heading1("一、基本信息")
build_table([
    ("姓名", "队长：____________　队员：____________（请赛前补充）"),
    ("组名", "粮智协同队（建议名称，可按实际修改）"),
    ("开发工具", "QoderWork（需求梳理、架构设计、代码生成、联调测试全流程）＋ LangChain / LangGraph（智能体编排）＋ Mem0 + Milvus（企业记忆）"),
    ("赛道", "【生产经营赛道】"),
    ("选题", "粮达e销——面向粮食贸易采购的多智能体协同决策与企业记忆平台。将粮达网已有的行情、粮源、物流、资金与风险服务能力，重组为“粮掌柜＋六位专业小二”的 AI 数字员工团队：把一句业务目标转成可比较、可解释、可执行的采购方案，并让每办成一件事都自动沉淀为企业可复用的组织知识。"),
])

heading1("二、智能体场景")
body(
    "粮食贸易采购长期面临“信息散在系统、决策依赖个人、经验难以传承”的困境：办一笔采购，"
    "采购员要在行情、粮源、物流、资金与风险之间逐个系统找信息、反复核对、自己拼方案，"
    "办完后经验留在个人脑中，人员一变就要从头再来。粮达e销不重建交易系统，而是把粮达网"
    "已有的业务能力重组为 AI 原生的粮贸服务协作平台——“粮掌柜”负责目标理解与跨专业编排，"
    "瞻（行情）、粮（粮源）、运（物流）、算（成本）、钱（资金）、安（风控）六位专业小二各司一职。"
    "用户不用先找功能，只需要叫小二；小二不用全部上场，只按需要入席。核心覆盖三类场景："
)
heading2("1. 主场景｜从一句话目标到可执行采购方案")
bullet(
    "目标理解：采购员只需说“库存只够 5 天，未来 15 天要采购 200 吨二等玉米到潍坊，"
    "不能影响生产，综合成本尽量控制在 2500 元/吨以内”。粮掌柜自动提取品种、数量、质量等级、"
    "到货地、交期、预算、保供与付款等关键要素，把企业历史偏好与本次已确认事实分开呈现，"
    "并通过“目标闸门”请用户确认口径。"
)
bullet(
    "按需组队：粮掌柜说明邀请每位小二的原因——瞻判采购时机、粮找候选粮源、运排运输方案、"
    "算核到厂成本、安做独立风险核查，钱小二因本次无资金缺口保持待命。用户通过“团队闸门”确认后，"
    "各小二按依赖关系并行办理，分别输出行情研判、候选粮源清单、运输方案、到厂成本与独立风险意见。"
)
bullet(
    "冲突会商：当方案 A 综合成本最低但履约证据不足、方案 B 每吨贵 18 元却交付更稳时，"
    "系统不抹平分歧，而是给出“方案 A 补齐履约担保后优先；若今日无法完成核验，立即切换方案 B，"
    "避免影响 15 天保供目标”的条件化建议。用户通过“方案闸门”拍板后，系统才生成风险核验、"
    "询价与询运等行动任务，全程留存完整决策轨迹。"
)
heading2("2. 专业场景｜每个小二都能独立办事，也能相互交接")
bullet(
    "瞻、粮、运：瞻小二把行情波动翻译成采购时机、关注条件与价格/时间触发提醒；"
    "粮小二从自然语言中抽取寻源要求，先做质量、数量、交期等硬条件过滤，再形成候选篮与多粮源对比；"
    "运小二比较公路、铁路、水运与多式联运的费用、时效与延误风险，生成可直接提交人工对接的标准询运需求。"
)
bullet(
    "算、钱、安：算小二统一货价、运费、损耗、质量折价与资金成本口径，完成到厂成本与盈亏推演，"
    "解决“最低报价不等于最低综合成本”；钱小二按金额、期限与付款节点匹配资金服务，"
    "给出主推、备选与排除原因，不承诺授信与放款；安小二独立审核合作方、合同、付款、质量与履约风险，"
    "不为主方案偏好而降低风险等级。"
)
bullet(
    "可信分工与结构化交接：大模型负责语言理解、解释生成与知识提炼，成本计算、硬条件过滤、"
    "资金准入与风险判定等关键数字一律由确定性规则完成；小二之间通过结构化“交接单”传递上下文，"
    "不重复填表，也避免模型对关键业务结论“自由发挥”。"
)
heading2("3. 成长场景｜每办成一件事，所有小二都更懂企业")
bullet(
    "自动沉淀：系统只从用户最终确认的办事记录中提炼企业事实、业务偏好与决策经验，"
    "如“安全库存按 7 天管理”“正常补库优先比较综合到厂成本”“雨季紧急补库优先选择能锁定车源与到货时间的方案”，"
    "让一次性的个人经验变成可复用的组织知识。"
)
bullet(
    "主动引用：后续相似任务中，任一小二都会主动展示引用了哪条经验、为什么适用、"
    "对当前排序或建议产生了什么影响——知识不是藏在后台的检索命中，而是用户和评委都能看见的决策依据。"
)
bullet(
    "可控纠偏：用户可选择“本次不采用”、编辑适用范围或全局停用；MySQL 保存权威知识状态，"
    "Mem0 + Milvus 负责跨小二语义召回，模型或向量服务异常时自动回退规则检索，业务主流程不中断。"
)

heading1("三、智能体价值")
p = new_para(LEAD_PPR)
add_runs(p, [
    ("价值主张：", True),
    ("把粮食贸易采购从“人找功能、人拼信息、人背经验”，升级为“AI 组角色、AI 组方案、人做决策、组织会成长”。", False),
])
bullet(
    "效率价值｜从串行沟通到并行协作：任务从一个自然语言入口发起，系统自动拆解、组队、并行办理并汇总行动清单；"
    "复杂采购决策准备时间较人工流程缩短 70% 以上，小二只补问真正影响结果的缺失条件，"
    "消除跨页面查找、重复填报与人工拼报告。"
)
bullet(
    "经营价值｜从最低报价到最优综合方案：货价、运费、损耗、质量折价、资金成本、时效与履约风险放进同一决策面板，"
    "“每吨贵 18 元的方案为什么可能更优”算得清、讲得明、可切换。"
)
bullet(
    "风险价值｜AI 提建议，但不越权：目标口径、协作范围、最终方案三道人工闸门，加上安小二独立风控与关键数字规则化计算，"
    "确保每条建议都带来源、依据、淘汰原因与生效条件，杜绝黑箱推荐、模型幻觉与责任不清。"
)
bullet(
    "组织价值｜从个人经验到企业复利：办事记录自动沉淀为企业共享知识库，下一位员工、下一个小二、下一次类似任务都能直接复用；"
    "知识可追溯、可拒绝、可修正、可停用，解决采购经验散落个人、人员变动后难以传承的行业难题。"
)
bullet(
    "可被验证的验收目标：目标关键要素识别完整率 ≥90%，高影响动作人工确认率与方案依据可追溯率均为 100%，"
    "相似任务企业经验主动引用率 ≥70%；以上为试点目标，正式应用后按真实业务数据持续校准。"
)

heading1("四、搭建思路")
body(
    "项目以 QoderWork 支撑需求梳理、架构设计、代码生成与联调测试全过程，"
    "采用“单小二先独立闭环—粮掌柜按需协同—企业记忆持续生长”的轻量路线分阶段落地。"
    "首版聚焦采购决策场景，不重建交易系统，不追求无边界自治，确保竞赛现场可运行、可解释、可演示。"
)
heading2("（一）整体架构")
bullet(
    "交互与业务层：React + TypeScript 构建深空科技风 Web 作业台，七位数字员工各有专业服务页；"
    "FastAPI 提供行情、寻源、物流、成本、资金、风控、知识与任务交接 API，MySQL 保存可追溯的业务记录。"
)
bullet(
    "智能与编排层：LangChain 负责需求理解、解释生成与知识提炼，LangGraph 负责任务状态机、"
    "并行办理节点、跨专业冲突检测与暂停恢复；粮掌柜中央编排，专业小二保持独立结论。"
)
bullet(
    "规则与记忆层：确定性规则承担硬条件过滤、成本计算、资金准入与风险冲突检测；"
    "MySQL 是企业知识事实源，Mem0 + Milvus 提供跨小二语义召回，知识引用效果写回形成闭环。"
)
bullet(
    "可信与降级层：三类 Human-in-the-loop 闸门守住高影响动作，前端展示来源、适用原因与决策轨迹；"
    "模型不可用时降级业务规则，向量服务不可用时降级 MySQL 检索，保障演示与业务主流程稳定。"
)
heading2("（二）搭建步骤")
build_table([
    ("步骤", "描述"),
    ("1｜痛点建模与角色定界",
     "围绕“复杂采购不会统筹、专业结果难取舍、办事结束无行动、经验无法复用”四个断点，"
     "用 QoderWork 梳理需求并输出设计，定义粮掌柜与六位专业小二的职责、输入输出和不可越权边界。"),
    ("2｜数据与规则底座",
     "构建行情、粮源、物流、成本、资金与风险数据模型，把质量、数量、交期、预算等硬约束"
     "以及成本、准入、冲突计算沉淀为可测试规则，保证关键数字不依赖模型生成。"),
    ("3｜单小二闭环跑通",
     "优先完成“自然语言提需求—结构化确认—候选比较—用户选择—生成办事记录”的闭环，"
     "每个小二可独立使用，并通过结构化交接单向其他小二传递上下文。"),
    ("4｜多智能体协同决策",
     "粮掌柜基于 LangGraph 按需组队、并行推进、识别跨专业冲突、形成条件化推荐；"
     "在目标、团队与方案节点嵌入人工确认，确认后才生成行动任务。"),
    ("5｜企业记忆与效果验证",
     "从已确认结果中自动提炼知识，经 Mem0 + Milvus 召回并在各小二页面显式引用；"
     "以效率、可追溯率、人工确认率与知识复用率验证 AI 的实际贡献。"),
], header_row=True)

doc.save(PATH)
print("saved:", PATH)
