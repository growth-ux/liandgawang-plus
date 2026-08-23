ALTER TABLE logistics_transport_tasks
ADD COLUMN decision_preference VARCHAR(16) NOT NULL DEFAULT 'balanced';
