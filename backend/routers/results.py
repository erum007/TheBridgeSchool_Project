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


router = APIRouter(prefix='/api/results', tags=['results'])


@router.post('/upload')
async def upload_results(
    file: UploadFile = File(...),
    subject: str = Form(...),
    class_name: str = Form(...),
    notify: bool = Form(False),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role not in {UserRole.admin, UserRole.teacher}:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail='Insufficient permissions')
    payload_rows = parse_results_upload(await file.read(), file.filename or 'results.csv')
    created = []
    for row in payload_rows:
        student = None
        if row.get('student_email'):
            student = db.query(User).filter(User.email == row['student_email']).first()
        if not student and row.get('student_name'):
            student = db.query(User).filter(User.name == row['student_name'], User.role == UserRole.student).first()
        if not student:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Student '{row.get('student_email') or row.get('student_name') or 'unknown'}' was not found. Register the student with a parent or guardian before uploading results.",
            )
        result = Result(
            student_id=student.id,
            subject=row['subject'] or subject,
            grade=row['grade'],
            class_average=row['class_average'],
            attendance=row['attendance'],
            term=row['term'],
            uploaded_by=current_user.id,
            batch_id=row['batch_id'],
        )
        db.add(result)
        created.append(result)
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
