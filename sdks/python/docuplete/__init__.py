"""Docuplete — official Python SDK.

Usage::

    import os
    from docuplete import Docuplete

    client = Docuplete(api_key=os.environ["DOCUPLETE_API_KEY"])
    result = client.sessions.create(package_id=42)
    print(result["interview_url"])

Webhook verification::

    from docuplete import construct_webhook_event, verify_webhook_signature
"""

from ._client  import Docuplete
from ._errors  import DocupleteError
from ._webhook import construct_webhook_event, verify_webhook_signature

__all__ = [
    "Docuplete",
    "DocupleteError",
    "construct_webhook_event",
    "verify_webhook_signature",
]

__version__ = "0.1.0"
