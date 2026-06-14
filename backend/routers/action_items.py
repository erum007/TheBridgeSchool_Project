from __future__ import annotations

from datetime import date

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, selectinload

from ..dependencies import get_current_user, get_db, require_roles
from ..models import ActionItem, ActionItemStatus, User, UserRole
from ..schemas import ActionItemCreate, ActionItemUpdate
from ..services.serialization import serialize_action_item


router = APIRouter(prefix='/api/action-items', tags=['action-items'])


@router.get('')
def list_action_items(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    query = db.query(ActionItem).options(selectinload(ActionItem.assigned_to_user)).order_by(ActionItem.created_at.desc())
    if current_user.role != UserRole.admin:
        query = query.filter(ActionItem.assigned_to == current_user.id)
    return [serialize_action_item(action_item) for action_item in query.all()]


@router.post('')
def create_action_item(payload: ActionItemCreate, db: Session = Depends(get_db), current_user: User = Depends(require_roles(UserRole.admin, UserRole.teacher))):
    if current_user.role == UserRole.teacher and not current_user.head_teacher:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail='Head teacher permission required')
    action_item = ActionItem(
        meeting_id=payload.meeting_id,
        description=payload.description,
        assigned_to=payload.assigned_to,
        due_date=date.fromisoformat(payload.due_date) if payload.due_date else None,
    )
    db.add(action_item)
    db.commit()
    db.refresh(action_item)
    action_item = db.query(ActionItem).options(selectinload(ActionItem.assigned_to_user)).filter(ActionItem.id == action_item.id).first()
    return serialize_action_item(action_item)


@router.patch('/{action_item_id}')
def update_action_item(action_item_id: int, payload: ActionItemUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    action_item = db.query(ActionItem).options(selectinload(ActionItem.assigned_to_user)).filter(ActionItem.id == action_item_id).first()
    if not action_item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Action item not found')
    if current_user.role != UserRole.admin and action_item.assigned_to != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail='Insufficient permissions')
    if payload.status is not None:
        action_item.status = ActionItemStatus(payload.status)
    if payload.description is not None:
        action_item.description = payload.description
    if payload.assigned_to is not None:
        action_item.assigned_to = payload.assigned_to
    if payload.due_date is not None:
        action_item.due_date = date.fromisoformat(payload.due_date) if payload.due_date else None
    db.commit()
    db.refresh(action_item)
    action_item = db.query(ActionItem).options(selectinload(ActionItem.assigned_to_user)).filter(ActionItem.id == action_item_id).first()
    return serialize_action_item(action_item)


@router.delete('/{action_item_id}')
def delete_action_item(action_item_id: int, db: Session = Depends(get_db), current_user: User = Depends(require_roles(UserRole.admin))):
    action_item = db.get(ActionItem, action_item_id)
    if not action_item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Action item not found')
    db.delete(action_item)
    db.commit()
    return {'detail': 'Action item deleted'}
