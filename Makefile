.PHONY: help install run start-bg stop status autostart-on autostart-off desktop-shortcut dev test test-server clean backup restore

PYTHON ?= python

help:
	@echo GRTS Commands:
	@echo   make install          - Install backend dependencies
	@echo   make start-bg         - Start backend silently in background (no terminal)
	@echo   make stop             - Stop background backend service
	@echo   make status           - Check if backend is running on port 8000
	@echo   make autostart-on     - Enable auto-start on Windows login (always on)
	@echo   make autostart-off    - Disable auto-start on Windows login
	@echo   make desktop-shortcut - Create 1-click launcher on Windows Desktop
	@echo   make run              - Start backend server in foreground with reload
	@echo   make test             - Run test suite
	@echo   make test-server      - Run local HTTP test fixtures server (port 8001)
	@echo   make backup           - Create a safe atomic DB snapshot and SQL dump
	@echo   make restore          - Restore DB from an available backup
	@echo   make zip              - Package addon into a zip file for distribution
	@echo   make clean            - Remove Python cache files

install:
	$(PYTHON) -m pip install -r backend/requirements.txt

start-bg:
	$(PYTHON) scripts/grts_service.py start

stop:
	$(PYTHON) scripts/grts_service.py stop

status:
	$(PYTHON) scripts/grts_service.py status

autostart-on:
	$(PYTHON) scripts/autostart.py --enable

autostart-off:
	$(PYTHON) scripts/autostart.py --disable

desktop-shortcut:
	$(PYTHON) scripts/autostart.py --desktop

run:
	$(PYTHON) -m uvicorn main:app --app-dir backend --reload --port 8000

dev: run

test:
	$(PYTHON) -m unittest discover tests

test-server:
	$(PYTHON) -m http.server 8001 --directory tests

backup:
	$(PYTHON) scripts/backup.py

restore:
	$(PYTHON) scripts/restore.py

zip:
	$(PYTHON) scripts/package_addon.py

clean:
	@$(PYTHON) -c "import pathlib, shutil; [shutil.rmtree(p) for p in pathlib.Path('.').rglob('__pycache__')]"
