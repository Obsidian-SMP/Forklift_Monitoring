import json
from datetime import datetime

from peewee import CharField, DateTimeField, TextField

from .database import db
from peewee import Model


class AlertEvent(Model):
    """Persisted alerts that do not originate from an existing domain table."""

    alert_id = CharField(unique=True, index=True)
    alert_type = CharField(index=True)
    severity = CharField(index=True)
    message = TextField()
    source = CharField(index=True)
    timestamp = DateTimeField(default=datetime.utcnow, index=True)
    metadata_json = TextField(default='{}')

    class Meta:
        database = db
        table_name = 'alert_events'

    def to_alert(self):
        try:
            metadata = json.loads(self.metadata_json or '{}')
        except (TypeError, ValueError):
            metadata = {}

        return {
            'id': self.alert_id,
            'type': self.alert_type,
            'severity': self.severity,
            'message': self.message,
            'source': self.source,
            'timestamp': self.timestamp.isoformat(),
            'metadata': metadata,
        }
