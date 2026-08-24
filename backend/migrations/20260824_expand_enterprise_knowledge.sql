-- 企业知识大脑：扩展现有共享经验并记录跨小二引用

ALTER TABLE shared_experiences
    MODIFY COLUMN source_record_id INT NULL,
    ADD COLUMN knowledge_type VARCHAR(16) NOT NULL DEFAULT 'decision',
    ADD COLUMN title VARCHAR(128) NOT NULL DEFAULT '企业经验',
    ADD COLUMN applicable_context JSON NULL,
    ADD COLUMN source_agent VARCHAR(32) NOT NULL DEFAULT 'system',
    ADD COLUMN source_title VARCHAR(128) NOT NULL DEFAULT '',
    ADD COLUMN origin VARCHAR(16) NOT NULL DEFAULT 'ai',
    ADD COLUMN evidence_count INT NOT NULL DEFAULT 1,
    ADD COLUMN supporting_sources JSON NULL,
    ADD COLUMN memory_id VARCHAR(128) NULL,
    ADD COLUMN memory_sync_status VARCHAR(16) NOT NULL DEFAULT 'pending';

UPDATE shared_experiences
SET applicable_context = JSON_ARRAY(), supporting_sources = JSON_ARRAY()
WHERE applicable_context IS NULL OR supporting_sources IS NULL;

CREATE INDEX ix_shared_experiences_knowledge_type ON shared_experiences (knowledge_type);
CREATE INDEX ix_shared_experiences_source_agent ON shared_experiences (source_agent);

-- 同一办事结果最多可提炼两条不同知识；标题相同的重复请求仍保持幂等。
ALTER TABLE shared_experiences DROP INDEX uq_experience_source;
ALTER TABLE shared_experiences
    ADD CONSTRAINT uq_experience_source_item UNIQUE (source_type, source_record_id, title);

CREATE TABLE knowledge_citations (
    id INT NOT NULL AUTO_INCREMENT,
    knowledge_id INT NOT NULL,
    agent_key VARCHAR(32) NOT NULL,
    task_type VARCHAR(32) NOT NULL,
    task_id INT NOT NULL,
    effect TEXT NOT NULL,
    accepted BOOLEAN NOT NULL DEFAULT TRUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_knowledge_citation_task (knowledge_id, agent_key, task_type, task_id),
    KEY ix_knowledge_citations_knowledge_id (knowledge_id),
    KEY ix_knowledge_citations_agent_key (agent_key),
    KEY ix_knowledge_citations_task_id (task_id)
);

ALTER TABLE logistics_transport_tasks
    ADD COLUMN memory_snapshot JSON NULL,
    ADD COLUMN memory_effect TEXT NULL,
    ADD COLUMN memory_accepted INT NOT NULL DEFAULT 1;

UPDATE logistics_transport_tasks
SET memory_snapshot = JSON_ARRAY(), memory_effect = ''
WHERE memory_snapshot IS NULL OR memory_effect IS NULL;
