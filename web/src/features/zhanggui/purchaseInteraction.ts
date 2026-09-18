import { purchaseStageRoles } from "./purchaseCollaboration";
import type { Purchase } from "./purchaseModel";

/** 每个阶段一个办理面板；参与小二和粮掌柜都能进入，不拆分同一步的确认动作。 */
export function purchaseInteraction(
  purchase: Purchase | null,
  stage: number,
  reviewing = false,
) {
  const roles = purchaseStageRoles(purchase, stage);
  const owner = [
    "da",
    "zhan",
    "an",
    "liang",
    "yun",
    purchase?.ordered ? "yun" : "da",
    "suan",
    "da",
  ][stage];
  const action = reviewing
    ? "回看本步办理"
    : [
        "描述采购需求",
        "查看行情与建议",
        "核验资质与资金",
        "选择粮源并点价",
        "选择运输方案",
        purchase?.ordered ? "查看履约进度" : "核验并确认下单",
        "查看到厂核算",
        "查看履约复盘",
      ][stage];
  const entries = Object.fromEntries(roles.members.map((id) => [id, action]));
  if (
    !reviewing &&
    stage === 2 &&
    purchase?.qualificationChecked &&
    !purchase.documentName
  ) {
    entries.an = "补充准入材料 · 继续核验";
  }
  return { owner, action, entries, roles };
}
