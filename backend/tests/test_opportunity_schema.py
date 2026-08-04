from datetime import date

import pytest
from pydantic import ValidationError

from backend.schemas.opportunity import OpportunityCreate


def test_opportunity_requires_all_public_fields():
    with pytest.raises(ValidationError):
        OpportunityCreate(
            title='Scholarship',
            eligibility='Grade 10 students',
            link='https://example.com/apply',
        )

    with pytest.raises(ValidationError):
        OpportunityCreate(
            title='  ',
            eligibility='Grade 10 students',
            deadline='2026-09-01',
            link='https://example.com/apply',
        )


def test_opportunity_normalizes_required_text_fields():
    opportunity = OpportunityCreate(
        title='  Scholarship  ',
        eligibility='  Grade 10 students ',
        deadline='2026-09-01',
        link=' https://example.com/apply ',
    )

    assert opportunity.title == 'Scholarship'
    assert opportunity.eligibility == 'Grade 10 students'
    assert opportunity.deadline == date(2026, 9, 1)
    assert opportunity.link == 'https://example.com/apply'
