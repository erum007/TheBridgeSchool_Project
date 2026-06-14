from __future__ import annotations

from datetime import datetime
from io import BytesIO
import uuid

import pandas as pd

from ..models import Result, User, UserRole


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
