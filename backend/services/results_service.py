from __future__ import annotations

import html
from datetime import datetime
from io import BytesIO
import uuid

import pandas as pd

from ..models import Result, User, UserRole
from .email_service import send_plain_email


def parse_results_upload(file_bytes: bytes, filename: str) -> list[dict]:
    if filename.lower().endswith('.csv'):
        frame = pd.read_csv(BytesIO(file_bytes))
    else:
        frame = pd.read_excel(BytesIO(file_bytes))

    normalized = {column.lower().strip().replace(' ', '_'): column for column in frame.columns}
    rows = []
    batch_id = uuid.uuid4().hex[:12]
    for _, row in frame.iterrows():
        rows.append(
            {
                'student_name': row.get(normalized.get('student_name', 'student_name'), row.get('name')),
                'student_email': row.get(normalized.get('student_email', 'student_email'), row.get('email')),
                'subject': row.get(normalized.get('subject', 'subject')),
                'grade': float(row.get(normalized.get('grade', 'grade'))),
                'class_average': float(row.get(normalized.get('class_average', 'class_average'), row.get('average'))),
                'attendance': float(row.get(normalized.get('attendance', 'attendance'), row.get('attendance_%', 0))),
                'term': row.get(normalized.get('term', 'term')),
                'batch_id': batch_id,
            }
        )
    return rows


def send_performance_report_emails(db, created_results: list, uploaded_by_user) -> dict:
    """
    For each unique student in created_results:
    - Fetch their User record
    - Find linked parents via parent_student_links table
    - Build a personalised plain-text email showing their results
    - Send to the student's email AND each parent's email
    - Return { 'sent': int, 'failed': int }
    """
    sent = 0
    failed = 0
    grouped_results: dict[int, list[Result]] = {}
    for result in created_results:
        grouped_results.setdefault(result.student_id, []).append(result)

    report_date = datetime.utcnow().strftime('%d %b %Y')
    teacher_name = getattr(uploaded_by_user, 'name', None) or 'Teacher'

    for student_id, student_results in grouped_results.items():
        try:
            student = db.query(User).filter(User.id == student_id, User.role == UserRole.student).first()
            if not student:
                failed += 1
                continue

            parents = [parent for parent in getattr(student, 'guardians', []) if getattr(parent, 'email', None)]
            recipients = []
            if getattr(student, 'email', None):
                recipients.append((student.email, student.name or 'Student'))
            for parent in parents:
                recipients.append((parent.email, parent.name or 'Parent'))

            if not recipients:
                failed += 1
                continue

            term = student_results[0].term or 'this term'
            subject = f'Performance Report for {student.name or "Student"} - {term}'

            def format_number(value):
                if value is None:
                    return '—'
                try:
                    numeric_value = float(value)
                except (TypeError, ValueError):
                    return str(value)
                if numeric_value.is_integer():
                    return str(int(numeric_value))
                return f'{numeric_value:g}'

            plain_rows = []
            html_rows = []
            for result in student_results:
                subject_text = str(result.subject or '')
                grade_text = format_number(result.grade)
                average_text = format_number(result.class_average)
                attendance_text = f'{format_number(result.attendance)}%'
                plain_rows.append(f'{subject_text:<16} | {grade_text:>5} | {average_text:>13} | {attendance_text}')
                html_rows.append(
                    f'<tr><td>{html.escape(subject_text)}</td><td>{html.escape(grade_text)}</td><td>{html.escape(average_text)}</td><td>{html.escape(attendance_text)}</td></tr>'
                )

            html_template = '''<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; color: #1a1a1a; margin: 0; padding: 0; }
    .container { max-width: 600px; margin: 0 auto; padding: 32px 24px; }
    .header { border-bottom: 3px solid #C0392B; padding-bottom: 16px; margin-bottom: 24px; }
    .school-name { color: #1B2B6B; font-size: 20px; font-weight: bold; margin: 0; }
    .title { color: #1B2B6B; font-size: 16px; margin: 8px 0 0 0; }
    .greeting { font-size: 15px; margin-bottom: 16px; }
    table { width: 100%; border-collapse: collapse; margin: 20px 0; }
    th { background: #1B2B6B; color: white; padding: 10px 14px; text-align: left; font-size: 13px; }
    td { padding: 10px 14px; border-bottom: 1px solid #e8e4dc; font-size: 14px; }
    tr:nth-child(even) td { background: #f7f8fc; }
    .footer { margin-top: 32px; padding-top: 16px; border-top: 1px solid #e8e4dc; font-size: 13px; color: #8a8a8a; }
    .footer strong { color: #1B2B6B; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <p class="school-name">The Bridge School</p>
      <p class="title">Student Performance Report</p>
    </div>
    <p class="greeting">Dear __RECIPIENT_NAME__,</p>
    <p>Please find below the performance report for <strong>__STUDENT_NAME__</strong> for <strong>__TERM__</strong>.</p>
    <table>
      <thead>
        <tr>
          <th>Subject</th>
          <th>Grade</th>
          <th>Class Average</th>
          <th>Attendance</th>
        </tr>
      </thead>
      <tbody>
        __ROWS__
      </tbody>
    </table>
    <p>This report was prepared by <strong>__UPLOADED_BY__</strong> on __DATE__.</p>
    <div class="footer">
      <strong>The Bridge School</strong><br>
      Mughal Hazara Goth, Block 4/A Gulistan-e-Johar, Karachi<br>
      This is an automated message. Please do not reply to this email.
    </div>
  </div>
</body>
</html>'''

            html_body = html_template.replace('__ROWS__', ''.join(html_rows))
            for recipient_email, recipient_name in recipients:
                plain_body = '\n'.join(
                    [
                        f'Dear {recipient_name},',
                        f'Please find below the performance report for {student.name or "Student"} for {term}.',
                        'Subject          | Grade | Class Average | Attendance',
                        '-----------------+-------+---------------+-----------',
                        *plain_rows,
                        f'This report was prepared by {teacher_name} on {report_date}.',
                        'Regards,',
                        'The Bridge School',
                    ]
                )
                rendered_html = (
                    html_body
                    .replace('__RECIPIENT_NAME__', html.escape(recipient_name))
                    .replace('__STUDENT_NAME__', html.escape(student.name or 'Student'))
                    .replace('__TERM__', html.escape(term))
                    .replace('__UPLOADED_BY__', html.escape(teacher_name))
                    .replace('__DATE__', html.escape(report_date))
                )
                try:
                    if send_plain_email(recipient_email, subject, plain_body, rendered_html):
                        sent += 1
                    else:
                        failed += 1
                except Exception:
                    failed += 1
        except Exception:
            failed += 1

    return {'sent': sent, 'failed': failed}
