from fastapi import APIRouter, Depends

from backend import documents
from backend.auth import require_auth

# Every feature router is included here, so all of /api sits behind the access code.
# Include feature routers before main.py includes this one: FastAPI copies routes at include time.
router = APIRouter(prefix="/api", dependencies=[Depends(require_auth)])
router.include_router(documents.router)
