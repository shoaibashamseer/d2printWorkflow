"""Local development settings using an isolated SQLite database.

Run the local backend with:
    python manage.py runserver --settings=WorkflowApp.settings_local

The default settings module remains unchanged for the production PostgreSQL
configuration.
"""

from .settings import *  # noqa: F401,F403

DEBUG = True
ALLOWED_HOSTS = [*ALLOWED_HOSTS, "testserver"]
DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": BASE_DIR / "db.local.sqlite3",
    }
}
