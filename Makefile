.PHONY: backend-install backend-run backend-curl up up-ollama down down-ollama logs ps build restart restart-ollama ollama-pull

backend-install:
	cd backend && python -m venv .venv && . .venv/bin/activate && pip install -r requirements.txt

backend-run:
	cd backend && . .venv/bin/activate && uvicorn app.main:app --reload --port 8000

backend-curl:
	curl -s http://localhost:8000/api/research \
	  -H "Content-Type: application/json" \
	  -d '{"query":"What are the main causes of inflation, and what policies reduce it?"}' | python -m json.tool

up:
	docker compose up -d --build

up-ollama:
	docker compose --profile ollama up -d --build

down:
	docker compose down

down-ollama:
	docker compose --profile ollama down

logs:
	docker compose logs -f --tail=200

ps:
	docker compose ps

build:
	docker compose build

restart:
	docker compose down
	docker compose up -d --build

restart-ollama:
	docker compose --profile ollama down
	docker compose --profile ollama up -d --build

ollama-pull:
	docker exec -it mara-ollama ollama pull $${OLLAMA_MODEL:-llama3.2:latest}