import pytest
from pydantic import ValidationError

from backend.schemas.email import EmailTemplateCreate


@pytest.mark.parametrize(
    ('field', 'value'),
    [
        ('name', '   '),
        ('subject', '\t'),
        ('body', ''),
        ('body', '<p><br></p>'),
        ('body', '<p>&nbsp;</p>'),
    ],
)
def test_template_requires_visible_text(field, value):
    payload = {'name': 'Update', 'subject': 'Weekly news', 'body': '<p>Hello</p>'}
    payload[field] = value

    with pytest.raises(ValidationError):
        EmailTemplateCreate(**payload)


def test_template_accepts_and_trims_required_text():
    template = EmailTemplateCreate(
        name='  Update  ',
        subject='  Weekly news  ',
        body='<p>Hello</p>',
    )

    assert template.name == 'Update'
    assert template.subject == 'Weekly news'
