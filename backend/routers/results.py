from __future__ import annotations

from io import StringIO
import uuid

import pandas as pd
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session, selectinload

from ..dependencies import get_current_user, get_db
from ..models import Result, User, UserRole
from ..services.results_service import parse_results_upload, send_performance_report_emails
from ..services.serialization import serialize_result
from ..services.notification_service import create_notification, notification_link


router = APIRouter(prefix='/api/results', tags=['results'])


@router.post('/upload')
async def upload_results(
    file: UploadFile = File(...),
    notify: bool = Form(False),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role not in {UserRole.admin, UserRole.teacher}:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail='Insufficient permissions')
    payload_rows = parse_results_upload(await file.read(), file.filename or 'results.csv')

    # Validate ALL rows before saving anything
    validated_students = []
    for index, row in enumerate(payload_rows, start=1):
        email = row.get('student_email')
        if not email or (isinstance(email, float) and pd.isna(email)):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Row {index}: missing student_email. All rows must include a student_email column.",
            )
        student = db.query(User).filter(User.email == email, User.role == UserRole.student).first()
        if not student:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Row {index}: no registered student found with email '{email}'. All students must be registered before uploading results.",
            )
        validated_students.append(student)

    created = []
    for row, student in zip(payload_rows, validated_students):
        result = Result(
            student_id=student.id,
            subject=row['subject'],
            grade=row['grade'],
            class_average=row['class_average'],
            attendance=row['attendance'],
            term=row['term'],
            uploaded_by=current_user.id,
            batch_id=row['batch_id'],
        )
        db.add(result)
        created.append(result)
        create_notification(
            db,
            student.id,
            'New result published',
            f'{result.subject} results for {result.term} are now available.',
            'result',
            notification_link(student.role, '/results'),
        )
        for guardian in student.guardians:
            create_notification(
                db,
                guardian.id,
                'New student result published',
                f'{student.name}’s {result.subject} results for {result.term} are now available.',
                'result',
                notification_link(guardian.role, '/results'),
            )
    db.commit()
    for result in created:
        db.refresh(result)

    emails_sent = 0
    emails_failed = 0
    if notify and created:
        summary = send_performance_report_emails(db, created, current_user)
        emails_sent = summary['sent']
        emails_failed = summary['failed']

    return {
        'count': len(created),
        'batch_id': created[0].batch_id if created else uuid.uuid4().hex[:12],
        'emails_sent': emails_sent,
        'emails_failed': emails_failed,
    }


@router.get('')
def list_results(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    query = db.query(Result).options(selectinload(Result.student), selectinload(Result.uploaded_by_user)).order_by(Result.created_at.desc())
    if current_user.role == UserRole.student:
        query = query.filter(Result.student_id == current_user.id)
    elif current_user.role == UserRole.parent:
        child_ids = [child.id for child in current_user.children]
        if child_ids:
            query = query.filter(Result.student_id.in_(child_ids))
        else:
            query = query.filter(Result.student_id == current_user.id)
    return [serialize_result(result) for result in query.all()]


@router.get('/batch/{batch_id}/download')
def download_batch(batch_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if current_user.role not in {UserRole.admin, UserRole.teacher}:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail='Insufficient permissions')

    results = db.query(Result).options(selectinload(Result.student)).filter(Result.batch_id == batch_id).order_by(Result.id.asc()).all()
    rows = [
        {
            'Student Name': result.student.name if result.student else '',
            'Email': result.student.email if result.student else '',
            'Subject': result.subject,
            'Grade': result.grade,
            'Class Average': result.class_average,
            'Attendance %': f'{result.attendance:g}%',
            'Term': result.term,
        }
        for result in results
    ]
    frame = pd.DataFrame(rows, columns=['Student Name', 'Email', 'Subject', 'Grade', 'Class Average', 'Attendance %', 'Term'])
    buffer = StringIO()
    frame.to_csv(buffer, index=False)
    response = StreamingResponse(iter([buffer.getvalue()]), media_type='text/csv')
    response.headers['Content-Disposition'] = f'attachment; filename="results_{batch_id}.csv"'
    return response


@router.delete('/batch/{batch_id}')
def delete_batch(batch_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if current_user.role != UserRole.admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail='Insufficient permissions')

    deleted = db.query(Result).filter(Result.batch_id == batch_id).delete(synchronize_session=False)
    db.commit()
    return {'deleted': deleted}
