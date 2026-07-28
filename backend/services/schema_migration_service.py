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
        },
        'scheduled_emails': {
            'attachments': 'JSON NULL',
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
        _migrate_whatsapp_action_item_reminders(connection, inspector)


def _migrate_whatsapp_action_item_reminders(connection, inspector) -> None:
    """Copy legacy WhatsApp action-item reminders into the email reminders table."""
    table_names = set(inspector.get_table_names())
    source_table = 'action_item_whatsapp_reminders'
    target_table = 'action_item_email_reminders'
    if source_table not in table_names or target_table not in table_names:
        return
    existing_action_item_ids = {
        row[0]
        for row in connection.execute(text(f'SELECT action_item_id FROM `{target_table}`')).fetchall()
    }
    rows = connection.execute(text(
        f'SELECT action_item_id, frequency, run_at, is_active, last_sent_at, created_by, created_at '
        f'FROM `{source_table}`'
    )).fetchall()
    for row in rows:
        action_item_id = row[0]
        if action_item_id in existing_action_item_ids:
            continue
        connection.execute(
            text(
                f'INSERT INTO `{target_table}` '
                f'(action_item_id, frequency, run_at, is_active, last_sent_at, created_by, created_at) '
                f'VALUES (:action_item_id, :frequency, :run_at, :is_active, :last_sent_at, :created_by, :created_at)'
            ),
            {
                'action_item_id': row[0],
                'frequency': row[1],
                'run_at': row[2],
                'is_active': row[3],
                'last_sent_at': row[4],
                'created_by': row[5],
                'created_at': row[6],
            },
        )
