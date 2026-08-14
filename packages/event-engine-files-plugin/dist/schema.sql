CREATE TABLE IF NOT EXISTS file_blobs (
  blob_id varchar(64) PRIMARY KEY,
  size_in_bytes integer NOT NULL,
  content_type varchar(64),
  type varchar(16) DEFAULT 'raw'
);

CREATE TABLE IF NOT EXISTS file_directories (
  directory_id varchar(32) PRIMARY KEY,
  path varchar(255) NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS file_links (
  link_id varchar(32) PRIMARY KEY,
  path varchar(255) NOT NULL,
  blob_id varchar(64),
  blocks TEXT,
  patches TEXT
);