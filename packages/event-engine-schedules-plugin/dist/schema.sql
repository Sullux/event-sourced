CREATE TABLE IF NOT EXISTS engine_schedules (
  schedule_id varchar(32) PRIMARY KEY,
  name varchar(128),
  cron varchar(64),
  at bigint,
  target_event TEXT NOT NULL,
  status varchar(16) NOT NULL DEFAULT 'active'
);