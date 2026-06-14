from __future__ import annotations

from datetime import date, datetime


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
        'is_active': user.is_active,
        'created_at': iso(user.created_at),
    }


def serialize_action_item(action_item):
    return {
        'id': action_item.id,
        'meeting_id': action_item.meeting_id,
        'description': action_item.description,
        'assigned_to': action_item.assigned_to,
        'assigned_to_name': getattr(getattr(action_item, 'assigned_to_user', None), 'name', None),
        'status': action_item.status.value if hasattr(action_item.status, 'value') else action_item.status,
        'due_date': iso(action_item.due_date),
        'created_at': iso(action_item.created_at),
    }


def serialize_meeting(meeting, include_nested=True):
    payload = {
        'id': meeting.id,
        'title': meeting.title,
        'scheduled_at': iso(meeting.scheduled_at),
        'department': meeting.department,
        'status': meeting.status.value if hasattr(meeting.status, 'value') else meeting.status,
        'notes': meeting.notes,
        'ai_summary': getattr(meeting, 'ai_summary', None),
        'created_by': meeting.created_by,
        'created_at': iso(meeting.created_at),
    }
    if include_nested:
        payload['attendees'] = [serialize_user(user) for user in getattr(meeting, 'attendees', [])]
        payload['action_items'] = [serialize_action_item(action_item) for action_item in getattr(meeting, 'action_items', [])]
    return payload


def serialize_email_template(template):
    return {
        'id': template.id,
        'name': template.name,
        'subject': template.subject,
        'body': template.body,
        'created_by': template.created_by,
        'created_by_name': getattr(getattr(template, 'created_by_user', None), 'name', None),
        'created_at': iso(template.created_at),
    }


def serialize_scheduled_email(email):
    return {
        'id': email.id,
        'template_id': email.template_id,
        'recipient_group': email.recipient_group,
        'subject': email.subject,
        'body': email.body,
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
    return {
        'id': notice.id,
        'title': notice.title,
        'body': notice.body,
        'recipients': notice.recipients.value if hasattr(notice.recipients, 'value') else notice.recipients,
        'status': notice.status.value if hasattr(notice.status, 'value') else notice.status,
        'publish_date': iso(notice.publish_date),
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
