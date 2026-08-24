-- 粮掌柜：共享经验增加来源类型，并创建四张任务编排表
-- 执行顺序：先扩展 shared_experiences，再建粮掌柜表

-- 1. shared_experiences 增加 source_type（costing/zhanggui），旧数据归入 costing
ALTER TABLE shared_experiences
ADD COLUMN source_type VARCHAR(32) NOT NULL DEFAULT 'costing';

-- 2. 用组合唯一索引替换原 source_record_id 单列唯一索引
ALTER TABLE shared_experiences DROP INDEX source_record_id;
CREATE INDEX ix_shared_experiences_source_record_id ON shared_experiences (source_record_id);
ALTER TABLE shared_experiences ADD CONSTRAINT uq_experience_source UNIQUE (source_type, source_record_id);

-- 3. 采购任务主表
CREATE TABLE procurement_missions (
    id INT NOT NULL AUTO_INCREMENT,
    mission_code VARCHAR(32) NOT NULL,
    title VARCHAR(128) NOT NULL DEFAULT '复杂采购任务',
    raw_request TEXT NOT NULL,
    goal_snapshot JSON NOT NULL,
    memory_snapshot JSON NOT NULL,
    team_snapshot JSON NOT NULL,
    conflict_snapshot JSON NOT NULL,
    recommendation_snapshot JSON NULL,
    phase VARCHAR(32) NOT NULL DEFAULT 'goal_confirmation',
    status VARCHAR(32) NOT NULL DEFAULT 'awaiting_goal_confirmation',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_mission_code (mission_code),
    KEY ix_procurement_missions_mission_code (mission_code)
);

-- 4. 小二办理记录：同一任务同一小二唯一
CREATE TABLE mission_agent_runs (
    id INT NOT NULL AUTO_INCREMENT,
    mission_id INT NOT NULL,
    agent_id VARCHAR(16) NOT NULL,
    participation_reason VARCHAR(256) NOT NULL DEFAULT '',
    status VARCHAR(32) NOT NULL DEFAULT 'pending',
    input_snapshot JSON NOT NULL,
    output_snapshot JSON NULL,
    error_message TEXT NULL,
    started_at DATETIME NULL,
    finished_at DATETIME NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    CONSTRAINT uq_mission_agent_run UNIQUE (mission_id, agent_id),
    KEY ix_mission_agent_runs_mission_id (mission_id),
    CONSTRAINT fk_agent_run_mission FOREIGN KEY (mission_id) REFERENCES procurement_missions (id)
);

-- 5. 人工决策记录：目标确认 / 团队确认 / 方案决策三类闸门
CREATE TABLE mission_decisions (
    id INT NOT NULL AUTO_INCREMENT,
    mission_id INT NOT NULL,
    gate_type VARCHAR(32) NOT NULL,
    prompt TEXT NOT NULL,
    options JSON NOT NULL,
    ai_recommendation TEXT NOT NULL,
    selected_action VARCHAR(32) NULL,
    note TEXT NOT NULL,
    status VARCHAR(16) NOT NULL DEFAULT 'pending',
    decided_at DATETIME NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY ix_mission_decisions_mission_id (mission_id),
    CONSTRAINT fk_decision_mission FOREIGN KEY (mission_id) REFERENCES procurement_missions (id)
);

-- 6. 行动任务：允许等待前置任务
CREATE TABLE mission_action_tasks (
    id INT NOT NULL AUTO_INCREMENT,
    mission_id INT NOT NULL,
    action_code VARCHAR(32) NOT NULL,
    agent_id VARCHAR(16) NOT NULL,
    title VARCHAR(128) NOT NULL,
    payload JSON NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'ready',
    scheme_id VARCHAR(8) NULL,
    prerequisite_action_id INT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY ix_mission_action_tasks_mission_id (mission_id),
    CONSTRAINT fk_action_task_mission FOREIGN KEY (mission_id) REFERENCES procurement_missions (id)
);
