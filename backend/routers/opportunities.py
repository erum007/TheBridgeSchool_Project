from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, selectinload
from datetime import date

from ..dependencies import get_current_user, get_db, require_roles
from ..models import Opportunity, User, UserRole
from ..schemas import OpportunityCreate
from ..services.serialization import serialize_opportunity


router = APIRouter(prefix='/api/opportunities', tags=['opportunities'])


@router.get('')
def list_opportunities(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    opportunities = db.query(Opportunity).options(selectinload(Opportunity.created_by_user)).order_by(Opportunity.created_at.desc()).all()
    return [serialize_opportunity(opportunity) for opportunity in opportunities]


@router.post('')
def create_opportunity(payload: OpportunityCreate, db: Session = Depends(get_db), current_user: User = Depends(require_roles(UserRole.admin))):
    opportunity = Opportunity(
        title=payload.title,
        eligibility=payload.eligibility,
        deadline=date.fromisoformat(payload.deadline) if payload.deadline else None,
        link=payload.link,
        created_by=current_user.id,
    )
    db.add(opportunity)
    db.commit()
    db.refresh(opportunity)
    opportunity = db.query(Opportunity).options(selectinload(Opportunity.created_by_user)).filter(Opportunity.id == opportunity.id).first()
    return serialize_opportunity(opportunity)


@router.delete('/{opportunity_id}')
def delete_opportunity(opportunity_id: int, db: Session = Depends(get_db), current_user: User = Depends(require_roles(UserRole.admin))):
    opportunity = db.get(Opportunity, opportunity_id)
    if not opportunity:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Opportunity not found')
    db.delete(opportunity)
    db.commit()
    return {'detail': 'Opportunity deleted'}
