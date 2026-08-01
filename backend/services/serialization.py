from __future__ import annotations

from datetime import date, datetime, timezone


def iso(value):
    if value is None:
        return None
    if isinstance(value, datetime):
        return value.isoformat()
    if isinstance(value, date):
        return value.isoformat()
    return value


def serialize_user(user):
    return {
        'id': user.id,
        'name': user.name,
        'email': user.email,
        'role': user.role.value if hasattr(user.role, 'value') else user.role,
        'head_teacher': user.head_teacher,
        'whatsapp_number': user.whatsapp_number,
        'department': user.department,
        'profile_picture_url': getattr(user, 'profile_picture_url', None),
        'email_notifications_enabled': getattr(user, 'email_notifications_enabled', True),
        'whatsapp_notifications_enabled': getattr(user, 'whatsapp_notifications_enabled', True),
        'departments': [department.name for department in getattr(user, 'departments', [])],
        'guardians': [
            {'id': guardian.id, 'name': guardian.name, 'email': guardian.email}
            for guardian in getattr(user, 'guardians', [])
        ],
        'children': [
            {'id': child.id, 'name': child.name, 'email': child.email}
            for child in getattr(user, 'children', [])
        ],
        'teachers': [
            {'id': teacher.id, 'name': teacher.name, 'email': teacher.email}
            for teacher in getattr(user, 'teachers', [])
        ],
        'students_taught': [
            {'id': student.id, 'name': student.name, 'email': student.email}
            for student in getattr(user, 'students_taught', [])
        ],
        'is_active': user.is_active,
        'created_at': iso(user.created_at),
    }


def serialize_action_item(action_item):
    reminder = getattr(action_item, 'email_reminder', None)
    return {
        'id': action_item.id,
        'meeting_id': action_item.meeting_id,
        'description': action_item.description,
        'assigned_to': action_item.assigned_to,
        'assigned_to_name': getattr(getattr(action_item, 'assigned_to_user', None), 'name', None),
        'status': action_item.status.value if hasattr(action_item.status, 'value') else action_item.status,
        'due_date': iso(action_item.due_date),
        'created_at': iso(action_item.created_at),
        'email_reminder': {
            'frequency': reminder.frequency,
            'run_at': iso(reminder.run_at),
            'is_active': reminder.is_active,
            'last_sent_at': iso(reminder.last_sent_at),
        } if reminder else None,
    }


def serialize_department(department):
    return {
        'id': department.id,
        'name': department.name,
        'members': [serialize_user(member) for member in getattr(department, 'members', [])],
        'created_at': iso(department.created_at),
    }


def serialize_meeting(meeting, include_nested=True):
    stored_status = meeting.status.value if hasattr(meeting.status, 'value') else meeting.status
    status = _display_meeting_status(stored_status, meeting.scheduled_at, getattr(meeting, 'end_time', None))
    payload = {
        'id': meeting.id,
        'title': meeting.title,
        'scheduled_at': _meeting_datetime_iso(meeting.scheduled_at),
        'end_time': _meeting_datetime_iso(getattr(meeting, 'end_time', None)),
        'department': meeting.department,
        'status': status,
        'notes': meeting.notes,
        'agenda': meeting.agenda,
        'meeting_mode': meeting.meeting_mode,
        'meeting_link': meeting.meeting_link,
        'location': meeting.location,
        'ai_summary': getattr(meeting, 'ai_summary', None),
        'created_by': meeting.created_by,
        'created_at': iso(meeting.created_at),
    }
    if include_nested:
        payload['attendees'] = [serialize_user(user) for user in getattr(meeting, 'attendees', [])]
        payload['action_items'] = [serialize_action_item(action_item) for action_item in getattr(meeting, 'action_items', [])]
    return payload


def _as_utc(value):
    if not isinstance(value, datetime):
        return None
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def _meeting_datetime_iso(value):
    utc_value = _as_utc(value)
    return utc_value.isoformat().replace('+00:00', 'Z') if utc_value else None


def _display_meeting_status(stored_status, scheduled_at, end_time=None):
    """Return the status used by clients without mutating the persisted meeting."""
    status = str(stored_status or '')
    if status == 'cancelled':
        return status

    start_time = _as_utc(scheduled_at)
    if not start_time:
        return status

    now = datetime.now(timezone.utc)
    if now < start_time:
        return 'upcoming'

    end_time_utc = _as_utc(end_time)
    if end_time_utc:
        if now <= end_time_utc:
            return 'ongoing'
        return 'past'

    return 'past'


def serialize_email_template(template):
    return {
        'id': template.id,
        'name': template.name,
        'subject': template.subject,
        'body': template.body,
        'attachments': template.attachments or [],
        'preheader': template.preheader or '',
        'category': template.category or '',
        'tags': template.tags or [],
        'is_favorite': bool(template.is_favorite),
        'publication_status': template.publication_status,
        'version_history': template.version_history or [],
        'created_by': template.created_by,
        'created_by_name': getattr(getattr(template, 'created_by_user', None), 'name', None),
        'created_at': iso(template.created_at),
        'updated_at': iso(template.updated_at),
    }


def serialize_scheduled_email(email):
    return {
        'id': email.id,
        'template_id': email.template_id,
        'recipient_group': email.recipient_group,
        'subject': email.subject,
        'body': email.body,
        'preheader': email.preheader or '',
        'attachments': email.attachments or [],
        'scheduled_at': iso(email.scheduled_at),
        'sent_at': iso(email.sent_at),
        'status': email.status.value if hasattr(email.status, 'value') else email.status,
        'created_by': email.created_by,
        'created_by_name': getattr(getattr(email, 'created_by_user', None), 'name', None),
        'created_at': iso(email.created_at),
    }


def serialize_result(result):
    student = getattr(result, 'student', None)
    uploader = getattr(result, 'uploaded_by_user', None)
    return {
        'id': result.id,
        'student_id': result.student_id,
        'student_name': getattr(student, 'name', None),
        'student_email': getattr(student, 'email', None),
        'subject': result.subject,
        'grade': result.grade,
        'class_average': result.class_average,
        'attendance': result.attendance,
        'term': result.term,
        'uploaded_by': result.uploaded_by,
        'uploaded_by_name': getattr(uploader, 'name', None),
        'batch_id': result.batch_id,
        'created_at': iso(result.created_at),
    }


def serialize_notice(notice):
    dept_list = getattr(notice, 'recipient_departments', []) or []
    user_list = getattr(notice, 'recipient_users', []) or []
    return {
        'id': notice.id,
        'title': notice.title,
        'body': notice.body,
        # New multi-recipient fields
        'recipient_roles': notice.recipient_roles if notice.recipient_roles is not None else [],
        'recipient_department_ids': [d.id for d in dept_list],
        'recipient_department_names': [d.name for d in dept_list],
        'recipient_users': [{'id': u.id, 'name': u.name, 'email': u.email, 'role': str(getattr(u.role, 'value', u.role))} for u in user_list],
        # Legacy field kept for backwards-compatible display
        'recipients': (notice.recipient_roles[0] if notice.recipient_roles else 'all'),
        'status': notice.status.value if hasattr(notice.status, 'value') else notice.status,
        'publish_datetime': iso(notice.publish_datetime),
        # Keep publish_date for any existing consumers still referencing it
        'publish_date': iso(notice.publish_datetime),
        'created_by': notice.created_by,
        'created_by_name': getattr(getattr(notice, 'created_by_user', None), 'name', None),
        'created_at': iso(notice.created_at),
    }


def serialize_opportunity(opportunity):
    return {
        'id': opportunity.id,
        'title': opportunity.title,
        'eligibility': opportunity.eligibility,
        'deadline': iso(opportunity.deadline),
        'link': opportunity.link,
        'created_by': opportunity.created_by,
        'created_by_name': getattr(getattr(opportunity, 'created_by_user', None), 'name', None),
        'created_at': iso(opportunity.created_at),
    }


def serialize_whatsapp_log(log):
    return {
        'id': log.id,
        'recipient_name': log.recipient_name,
        'phone_number': log.phone_number,
        'message': log.message,
        'status': log.status.value if hasattr(log.status, 'value') else log.status,
        'sent_at': iso(log.sent_at),
        'sent_by': log.sent_by,
        'sent_by_name': getattr(getattr(log, 'sent_by_user', None), 'name', None),
    }
