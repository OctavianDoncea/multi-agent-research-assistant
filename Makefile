.PHONY: backend-install backend-run backend-curl

backend-install:
	cd backend && python -m venv .venv && . .venv/bin/activate && pip install -r requirements.txt

backend-run:
	cd backend && . .venv/bin/activate && uvicorn app.main:app --reload --port 8000

backend-curl:
	curl -s gttp://localhost:8000/api/research \
		-H "Content-Type: application/json" \
		