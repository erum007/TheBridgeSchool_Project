from __future__ import annotations

from apscheduler.schedulers.background import BackgroundScheduler


# A small grace period prevents a job from being silently skipped when the
# server is briefly busy or restarting at its scheduled time. Coalescing keeps
# a recurring reminder to one delivery after downtime instead of replaying a
# backlog of duplicate reminders.
scheduler = BackgroundScheduler(
    timezone='UTC',
    job_defaults={
        'coalesce': True,
        'max_instances': 1,
        'misfire_grace_time': 3600,
    },
)


def ensure_scheduler_started() -> BackgroundScheduler:
    if not scheduler.running:
        scheduler.start()
    return scheduler
