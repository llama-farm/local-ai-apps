"""
Elder Care Monitoring Demo - FastAPI Application

Main application setup with CORS and route registration.
"""

from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from src.api.routes import health, anomaly, classifier, agent, streaming, models


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan events."""
    # Startup
    print("Elder Care Monitoring Demo API starting...")
    yield
    # Shutdown
    print("Elder Care Monitoring Demo API shutting down...")


def create_app() -> FastAPI:
    """Create and configure the FastAPI application."""

    app = FastAPI(
        title="Elder Care Monitoring Demo",
        description="""
        Demo API for the "Stop Using LLMs for Everything" presentation.

        This API demonstrates:
        - **Anomaly Detection** using One-Class SVM and Isolation Forest
        - **Text Classification** using SetFit/ModernBERT
        - **LLM Agent** with inline tool calling
        - **Streaming Demo** for real-time data processing

        All backed by LlamaFarm's specialized ML models.
        """,
        version="1.0.0",
        lifespan=lifespan,
    )

    # Configure CORS for React frontend
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["http://localhost:5173", "http://localhost:3000", "*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Register routes
    app.include_router(health.router)
    app.include_router(anomaly.router)
    app.include_router(classifier.router)
    app.include_router(agent.router)
    app.include_router(streaming.router)
    app.include_router(models.router)

    return app


app = create_app()
