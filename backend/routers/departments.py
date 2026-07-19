from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, selectinload

from ..dependencies import get_db, require_roles
from ..models import Department, User, UserRole
from ..schemas import DepartmentCreate, DepartmentMemberUpdate
from ..services.serialization import serialize_department


router = APIRouter(prefix='/api/departments', tags=['departments'])


@router.get('')
def list_departments(db: Session = Depends(get_db), current_user: User = Depends(require_roles(UserRole.admin))):
    departments = db.query(Department).options(selectinload(Department.members)).order_by(Department.name).all()
    return [serialize_department(department) for department in departments]


@router.post('')
def create_department(payload: DepartmentCreate, db: Session = Depends(get_db), current_user: User = Depends(require_roles(UserRole.admin))):
    name = payload.name.strip()
    if db.query(Department).filter(Department.name == name).first():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail='A department/domain with that name already exists')
    department = Department(name=name)
    db.add(department)
    db.commit()
    db.refresh(department)
    return serialize_department(department)


@router.post('/{department_id}/members')
def add_member(department_id: int, payload: DepartmentMemberUpdate, db: Session = Depends(get_db), current_user: User = Depends(require_roles(UserRole.admin))):
    department = db.query(Department).options(selectinload(Department.members)).filter(Department.id == department_id).first()
    user = db.get(User, payload.user_id)
    if not department or not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Department or user not found')
    if user not in department.members:
        department.members.append(user)
        db.commit()
    return serialize_department(department)


@router.delete('/{department_id}/members/{user_id}')
def remove_member(department_id: int, user_id: int, db: Session = Depends(get_db), current_user: User = Depends(require_roles(UserRole.admin))):
    department = db.query(Department).options(selectinload(Department.members)).filter(Department.id == department_id).first()
    user = db.get(User, user_id)
    if not department or not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Department or user not found')
    if user in department.members:
        department.members.remove(user)
        db.commit()
    return serialize_department(department)
