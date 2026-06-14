from __future__ import annotations

from .common import ORMBaseModel


class ResultRead(ORMBaseModel):
    id: int
    student_id: int
    student_name: str | None = None
    student_email: str | None = None
    subject: str
    grade: float
    class_average: float
    attendance: float
    term: str
    uploaded_by: int
    uploaded_by_name: str | None = None
    batch_id: str | None = None
    created_at: str
