from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy.orm import Session, selectinload

from ..dependencies import get_current_user, get_db
from ..models import Result, User, UserRole
from ..services.auth_service import get_password_hash
from ..services.results_service import parse_results_upload
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
            generated_email = row.get('student_email') or f"{str(row.get('student_name') or 'student').lower().replace(' ', '.')}@bridge.local"
            student = User(
                name=str(row.get('student_name') or 'Student'),
                email=generated_email,
                hashed_password=get_password_hash('password123'),
                role=UserRole.student,
            )
            db.add(student)
            db.flush()
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
    return {'count': len(created), 'batch_id': created[0].batch_id if created else uuid.uuid4().hex[:12]}


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
