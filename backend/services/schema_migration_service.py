from __future__ import annotations

from sqlalchemy import inspect, text


def apply_additive_schema_updates(engine) -> None:
    """Apply the small additive migrations needed by installations created before these fields existed."""
    inspector = inspect(engine)
    additions = {
        'users': {
            'department': 'VARCHAR(120) NULL',
            'profile_picture_url': 'MEDIUMTEXT NULL',
            'email_notifications_enabled': 'BOOLEAN NOT NULL DEFAULT TRUE',
            'pending_email': 'VARCHAR(255) NULL',
            'email_change_current_token': 'VARCHAR(64) NULL',
            'email_change_new_token': 'VARCHAR(64) NULL',
            'email_change_expires_at': 'DATETIME NULL',
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
            # Earlier releases created this as VARCHAR(4000); some installations
            # have an even older, shorter VARCHAR.  Both reject valid data URLs.
            connection.execute(text('ALTER TABLE `users` MODIFY COLUMN `profile_picture_url` MEDIUMTEXT NULL'))
        if 'opportunities' in inspector.get_table_names():
            # Opportunities without any of their public-facing details are not
            # useful listings. Remove legacy incomplete rows before applying the
            # stricter database constraint below.
            connection.execute(text(
                "DELETE FROM `opportunities` "
                "WHERE `title` IS NULL OR TRIM(`title`) = '' "
                "OR `eligibility` IS NULL OR TRIM(`eligibility`) = '' "
                "OR `deadline` IS NULL OR `link` IS NULL OR TRIM(`link`) = ''"
            ))
            if engine.dialect.name in {'mysql', 'mariadb'}:
                connection.execute(text(
                    'ALTER TABLE `opportunities` '
                    'MODIFY COLUMN `deadline` DATE NOT NULL, '
                    'MODIFY COLUMN `link` VARCHAR(500) NOT NULL'
                ))
        _migrate_notice_schema(connection, inspector)
        _remove_retired_messaging_schema(connection, inspector)


def _migrate_notice_schema(connection, inspector) -> None:
    """Migrate the notices table from the old single-recipient model to the new multi-recipient model."""
    import json as _json
    table_names = set(inspector.get_table_names())
    if 'notices' not in table_names:
        return

    existing_columns = {col['name'] for col in inspector.get_columns('notices')}

    # Add recipient_roles JSON column if missing
    if 'recipient_roles' not in existing_columns:
        connection.execute(text('ALTER TABLE `notices` ADD COLUMN `recipient_roles` JSON NULL'))
        # Migrate data from old `recipients` enum column if it exists
        if 'recipients' in existing_columns:
            rows = connection.execute(text('SELECT id, recipients FROM `notices`')).fetchall()
            for row in rows:
                old_value = row[1]
                new_value = _json.dumps([old_value] if old_value else ['all'])
                connection.execute(
                    text('UPDATE `notices` SET `recipient_roles` = :v WHERE id = :id'),
                    {'v': new_value, 'id': row[0]},
                )
        else:
            # Default to 'all' for existing rows that have no value yet
            connection.execute(
                text('UPDATE `notices` SET `recipient_roles` = :v WHERE `recipient_roles` IS NULL'),
                {'v': _json.dumps(['all'])},
            )

    # Add publish_datetime column if missing
    if 'publish_datetime' not in existing_columns:
        connection.execute(text('ALTER TABLE `notices` ADD COLUMN `publish_datetime` DATETIME NULL'))
        # Copy old publish_date values into publish_datetime
        if 'publish_date' in existing_columns:
            connection.execute(text(
                'UPDATE `notices` SET `publish_datetime` = CAST(`publish_date` AS DATETIME) '
                'WHERE `publish_date` IS NOT NULL AND `publish_datetime` IS NULL'
            ))

    # Create notice_department_groups join table if missing
    if 'notice_department_groups' not in table_names:
        connection.execute(text(
            'CREATE TABLE `notice_department_groups` ('
            '  `notice_id` INT NOT NULL,'
            '  `department_id` INT NOT NULL,'
            '  PRIMARY KEY (`notice_id`, `department_id`),'
            '  CONSTRAINT `fk_ndg_notice` FOREIGN KEY (`notice_id`) REFERENCES `notices`(`id`) ON DELETE CASCADE,'
            '  CONSTRAINT `fk_ndg_department` FOREIGN KEY (`department_id`) REFERENCES `departments`(`id`) ON DELETE CASCADE'
            ')'
        ))

    # Create notice_user_groups join table if missing
    if 'notice_user_groups' not in table_names:
        connection.execute(text(
            'CREATE TABLE `notice_user_groups` ('
            '  `notice_id` INT NOT NULL,'
            '  `user_id` INT NOT NULL,'
            '  PRIMARY KEY (`notice_id`, `user_id`),'
            '  CONSTRAINT `fk_nug_notice` FOREIGN KEY (`notice_id`) REFERENCES `notices`(`id`) ON DELETE CASCADE,'
            '  CONSTRAINT `fk_nug_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE'
            ')'
        ))


def _remove_retired_messaging_schema(connection, inspector) -> None:
    """Remove data and fields from the retired messaging integration."""
    table_names = set(inspector.get_table_names())
    for table_name in ('whatsapp_logs', 'action_item_whatsapp_reminders'):
        if table_name in table_names:
            connection.execute(text(f'DROP TABLE `{table_name}`'))
    if 'users' not in table_names:
        return
    columns = {column['name'] for column in inspector.get_columns('users')}
    for column_name in ('whatsapp_number', 'whatsapp_notifications_enabled'):
        if column_name in columns:
            connection.execute(text(f'ALTER TABLE `users` DROP COLUMN `{column_name}`'))
