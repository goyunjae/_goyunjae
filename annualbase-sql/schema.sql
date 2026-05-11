-- AnnualBase SQL schema reference
-- This file is safe to share. It contains schema only, no data.

CREATE TABLE institutions (
    institution_id AUTOINCREMENT PRIMARY KEY,
    institution_name TEXT(255),
    short_name TEXT(100),
    notes MEMO,
    created_at DATETIME
);

CREATE TABLE annual_reports (
    report_id AUTOINCREMENT PRIMARY KEY,
    institution_id LONG,
    report_year LONG,
    report_title TEXT(255),
    source_file MEMO,
    report_status TEXT(50),
    created_at DATETIME
);

CREATE TABLE report_files (
    file_id AUTOINCREMENT PRIMARY KEY,
    report_id LONG,
    file_role TEXT(80),
    file_name TEXT(255),
    folder_path MEMO,
    file_ext TEXT(20),
    notes MEMO,
    created_at DATETIME
);

CREATE TABLE report_sections (
    section_id AUTOINCREMENT PRIMARY KEY,
    report_id LONG,
    parent_section_id LONG,
    section_level TEXT(30),
    section_code TEXT(50),
    section_title MEMO,
    sort_order LONG,
    notes MEMO
);

CREATE TABLE content_items (
    content_id AUTOINCREMENT PRIMARY KEY,
    report_id LONG,
    section_id LONG,
    content_type TEXT(50),
    summary MEMO,
    keywords MEMO,
    source_note MEMO,
    evidence_status TEXT(50),
    notes MEMO,
    created_at DATETIME
);

CREATE TABLE performance_indicators (
    indicator_id AUTOINCREMENT PRIMARY KEY,
    report_id LONG,
    section_id LONG,
    indicator_name TEXT(255),
    base_value DOUBLE,
    target_value DOUBLE,
    actual_value DOUBLE,
    achievement_rate DOUBLE,
    unit_name TEXT(50),
    source_note MEMO,
    notes MEMO
);

CREATE TABLE budget_items (
    budget_id AUTOINCREMENT PRIMARY KEY,
    report_id LONG,
    section_id LONG,
    budget_category TEXT(255),
    planned_amount CURRENCY,
    executed_amount CURRENCY,
    execution_rate DOUBLE,
    unit_name TEXT(50),
    source_note MEMO,
    notes MEMO
);

CREATE TABLE evidence_files (
    evidence_id AUTOINCREMENT PRIMARY KEY,
    report_id LONG,
    evidence_name TEXT(255),
    file_name TEXT(255),
    folder_path MEMO,
    file_status TEXT(50),
    notes MEMO,
    created_at DATETIME
);

CREATE TABLE content_evidence_links (
    link_id AUTOINCREMENT PRIMARY KEY,
    content_id LONG,
    evidence_id LONG,
    link_note MEMO
);

CREATE TABLE import_logs (
    import_id AUTOINCREMENT PRIMARY KEY,
    import_type TEXT(80),
    source_path MEMO,
    imported_rows LONG,
    imported_at DATETIME,
    notes MEMO
);

CREATE INDEX ix_reports_year ON annual_reports (report_year);
CREATE INDEX ix_sections_report ON report_sections (report_id);
CREATE INDEX ix_content_report ON content_items (report_id);
CREATE INDEX ix_indicators_report ON performance_indicators (report_id);
CREATE INDEX ix_budget_report ON budget_items (report_id);
CREATE INDEX ix_evidence_report ON evidence_files (report_id);
