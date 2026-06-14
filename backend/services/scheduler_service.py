from __future__ import annotations

from apscheduler.schedulers.background import BackgroundScheduler


scheduler = BackgroundScheduler(timezone='UTC')


def ensure_scheduler_started() -> BackgroundScheduler:
    if not scheduler.running:
        scheduler.start()
    return scheduler
