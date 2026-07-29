from __future__ import annotations

from sqlalchemy import inspect, text


def apply_additive_schema_updates(engine) -> None:
    """Apply the small additive migrations needed by installations created before these fields existed."""
    inspector = inspect(engine)
    additions = {
        'users': {
            'department': 'VARCHAR(120) NULL',
        },
        'meetings': {
            'end_time': 'DATETIME NULL',
            'agenda': 'TEXT NULL',
            'meeting_mode': "VARCHAR(24) NOT NULL DEFAULT 'in_person'",
            'meeting_link': 'VARCHAR(1000) NULL',
            'location': 'VARCHAR(500) NULL',
        },
        'email_templates': {
            'attachments': 'JSON NULL',
            'preheader': 'VARCHAR(255) NULL',
            'category': 'VARCHAR(80) NULL',
            'tags': 'JSON NULL',
            'is_favorite': 'BOOLEAN NOT NULL DEFAULT FALSE',
            'publication_status': "VARCHAR(20) NOT NULL DEFAULT 'published'",
            'version_history': 'JSON NULL',
            'updated_at': 'DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP',
        },
        'scheduled_emails': {
            'attachments': 'JSON NULL',
            'preheader': 'VARCHAR(255) NULL',
        },
    }
    with engine.begin() as connection:
        for table_name, columns in additions.items():
            if table_name not in inspector.get_table_names():
                continue
            existing_columns = {column['name'] for column in inspector.get_columns(table_name)}
            for column_name, definition in columns.items():
                if column_name not in existing_columns:
                    connection.execute(text(f'ALTER TABLE `{table_name}` ADD COLUMN `{column_name}` {definition}'))
        if 'users' in inspector.get_table_names() and engine.dialect.name in {'mysql', 'mariadb'}:
            connection.execute(text("ALTER TABLE `users` MODIFY COLUMN `role` ENUM('admin','teacher','staff','student','parent') NOT NULL"))
