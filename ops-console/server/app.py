from __future__ import annotations

import copy
import json
import os
import subprocess
import threading
import time
from collections import deque
from pathlib import Path
from typing import Any
from urllib import error, request

import psutil
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles


ROOT_DIR = Path(__file__).resolve().parents[2]
WEB_DIR = ROOT_DIR / "ops-console" / "web"
MANAGE_SCRIPT = ROOT_DIR / "ops" / "manage-projects.ps1"
OPS_PORT = 3210
CREATE_NO_WINDOW = getattr(subprocess, "CREATE_NO_WINDOW", 0)


def now_iso() -> str:
    return time.strftime("%Y-%m-%dT%H:%M:%S%z")


def read_env_file(path: Path) -> dict[str, str]:
    values: dict[str, str] = {}
    if not path.exists():
        return values

    for raw_line in path.read_text(encoding="utf-8", errors="replace").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        values[key.strip()] = value.strip().strip('"').strip("'")
    return values


def probe_http(url: str, timeout: float = 1.5) -> dict[str, Any]:
    try:
        with request.urlopen(url, timeout=timeout) as response:
            content = response.read(4096).decode("utf-8", errors="replace")
            return {
                "ok": 200 <= response.status < 400,
                "status": response.status,
                "content": content,
            }
    except error.HTTPError as exc:
        body = exc.read(4096).decode("utf-8", errors="replace")
        return {"ok": False, "status": exc.code, "content": body}
    except Exception:
        return {"ok": False, "status": None, "content": ""}


def wait_for(predicate, timeout: float, interval: float = 0.25) -> bool:
    deadline = time.time() + timeout
    while time.time() < deadline:
        if predicate():
            return True
        time.sleep(interval)
    return predicate()


class RuntimeController:
    def __init__(self) -> None:
        self.root_dir = ROOT_DIR
        self.env_file = self.root_dir / ".env.local"
        self.env_values = read_env_file(self.env_file)
        self.logs_dir = self.root_dir / "logs" / "local-server"
        self.ops_log_file = self.root_dir / "logs" / "ops-console.log"
        self.local_manager_script = self.root_dir / "scripts" / "local-server-manager.ps1"
        self.state_dir = self.root_dir / ".local-server-state"
        self.state_file = self.state_dir / "services.json"
        self.frontend_dir = self.root_dir / "bio-inventory-frontend"
        self.backend_dir = self.root_dir / "bio-inventory-backend"
        self.dymo_dir = self.root_dir / "dymo-print-server-nodejs"
        self.frontend_build_dir = self.frontend_dir / "build"
        self.frontend_serve_config = self.frontend_dir / "serve.json"
        self.backend_port = 8000
        self.frontend_port = 3000
        self.cellstorage_port = 5000
        self.backend_health_url = f"http://127.0.0.1:{self.backend_port}/health/"
        self.backend_ready_url = f"http://127.0.0.1:{self.backend_port}/ready/"
        self.frontend_url = f"http://127.0.0.1:{self.frontend_port}/"
        self.cellstorage_url = f"http://127.0.0.1:{self.cellstorage_port}/"
        self.cellstorage_root = Path(
            self.env_values.get("CELLSTORAGE_ROOT", r"D:\Qiyao\CellStorage-modify_log_251104")
        )
        self.cellstorage_service_name = self.env_values.get("CELLSTORAGE_SERVICE_NAME", "CellStorageApp")
        self.cellstorage_print_task_name = self.env_values.get("CELLSTORAGE_PRINT_TASK_NAME", "CellStorage Print Agent")
        self.cellstorage_print_dir = self.cellstorage_root / "dymo-print-server-nodejs" / "src_local"
        self.cellstorage_app_log = self.cellstorage_root / "service_log.txt"
        self.cellstorage_print_log = self.cellstorage_print_dir / "print_agent_service_log.txt"
        self.service_defs = {
            "backend": {
                "id": "quartzy-backend",
                "project": "quartzy",
                "name": "Backend API",
                "port": self.backend_port,
                "url": self.backend_health_url,
                "default_log": self.logs_dir / "backend.log",
                "markers": ("waitress", "core.wsgi:application"),
                "path_markers": (str(self.backend_dir).lower(),),
            },
            "frontend": {
                "id": "quartzy-frontend",
                "project": "quartzy",
                "name": "Frontend Static Server",
                "port": self.frontend_port,
                "url": self.frontend_url,
                "default_log": self.logs_dir / "frontend-serve.log",
                "markers": ("serve", str(self.frontend_port)),
                "path_markers": (str(self.frontend_dir).lower(),),
            },
            "dymo": {
                "id": "quartzy-dymo",
                "project": "quartzy",
                "name": "DYMO Agent",
                "port": None,
                "url": None,
                "default_log": self.logs_dir / "dymo.log",
                "markers": ("production_print_agent.py",),
                "path_markers": (str(self.dymo_dir).lower(),),
            },
        }
        self._lock = threading.RLock()
        self._status_changed = threading.Condition(self._lock)
        self._stop_event = threading.Event()
        self._active_actions: dict[str, dict[str, Any]] = {}
        self._action_history: deque[dict[str, Any]] = deque(maxlen=30)
        self._action_counter = 0
        self._snapshot_version = 0
        self._snapshot: dict[str, Any] = {}
        self._components = self._build_initial_components()
        self._task_exists_cache = False
        self._task_state_cache = "Unknown"
        self._load_state_file()
        self._adopt_existing_processes()
        with self._lock:
            self._publish_locked(force=True)

    def start(self) -> None:
        threading.Thread(target=self._fast_monitor_loop, name="ops-fast-monitor", daemon=True).start()
        threading.Thread(target=self._slow_monitor_loop, name="ops-slow-monitor", daemon=True).start()

    def stop(self) -> None:
        self._stop_event.set()
        with self._status_changed:
            self._status_changed.notify_all()

    def get_snapshot(self) -> dict[str, Any]:
        with self._lock:
            return copy.deepcopy(self._snapshot)

    def stream_status(self):
        last_version = -1
        while not self._stop_event.is_set():
            with self._status_changed:
                self._status_changed.wait_for(
                    lambda: self._snapshot_version != last_version or self._stop_event.is_set(),
                    timeout=15.0,
                )
                snapshot = copy.deepcopy(self._snapshot)
                last_version = self._snapshot_version
            yield f"data: {json.dumps(snapshot)}\n\n"

    def get_logs(self) -> list[dict[str, str]]:
        return self.get_snapshot().get("logs", [])

    def get_log_path(self, target: str) -> Path | None:
        for item in self.get_logs():
            if item["id"] == target:
                return Path(item["path"])
        return None

    def submit_action(self, action_name: str) -> dict[str, Any]:
        if action_name in {"repair-startup", "open-logs", "quartzy-release"}:
            return self._submit_shell_action(action_name)
        return self._submit_runtime_action(action_name)

    def _submit_runtime_action(self, action_name: str) -> dict[str, Any]:
        project = "quartzy" if action_name.startswith("quartzy-") else "cellstorage"
        display_name = {
            "quartzy-start": "Start Quartzy",
            "quartzy-stop": "Stop Quartzy",
            "quartzy-restart": "Restart Quartzy",
            "cellstorage-start": "Start CellStorage",
            "cellstorage-stop": "Stop CellStorage",
            "cellstorage-restart": "Restart CellStorage",
            "cellstorage-print-restart": "Restart CellStorage Print Agent",
        }[action_name]

        with self._lock:
            blocking = self._get_blocking_action_locked()
            if blocking is not None:
                raise HTTPException(status_code=409, detail=f"Action already running: {blocking['name']}")
            action = self._new_action_locked(action_name, display_name, project)

        worker = threading.Thread(
            target=self._run_runtime_action,
            args=(action["id"], action_name),
            name=f"action-{action_name}",
            daemon=True,
        )
        worker.start()
        return {"accepted": True, "actionId": action["id"]}

    def _submit_shell_action(self, action_name: str) -> dict[str, Any]:
        display_name = {
            "quartzy-release": "Release Quartzy",
            "repair-startup": "Repair Boot Tasks",
            "open-logs": "Open Logs Folder",
        }[action_name]
        project = "quartzy" if action_name == "quartzy-release" else "system"

        with self._lock:
            blocking = self._get_blocking_action_locked()
            if blocking is not None:
                raise HTTPException(status_code=409, detail=f"Action already running: {blocking['name']}")
            action = self._new_action_locked(action_name, display_name, project)

        worker = threading.Thread(
            target=self._run_shell_action,
            args=(action["id"], action_name),
            name=f"shell-action-{action_name}",
            daemon=True,
        )
        worker.start()
        return {"accepted": True, "actionId": action["id"]}

    def _run_runtime_action(self, action_id: str, action_name: str) -> None:
        try:
            self._set_action_phase(action_id, "running", "Preparing action", blocking=True)
            if action_name == "quartzy-start":
                self._action_quartzy_start(action_id)
            elif action_name == "quartzy-stop":
                self._action_quartzy_stop(action_id)
            elif action_name == "quartzy-restart":
                self._action_quartzy_restart(action_id)
            elif action_name == "cellstorage-start":
                self._action_cellstorage_start(action_id)
            elif action_name == "cellstorage-stop":
                self._action_cellstorage_stop(action_id)
            elif action_name == "cellstorage-restart":
                self._action_cellstorage_restart(action_id)
            elif action_name == "cellstorage-print-restart":
                self._action_cellstorage_print_restart(action_id)
            else:
                raise RuntimeError(f"Unsupported action: {action_name}")
        except Exception as exc:
            self._finish_action(
                action_id,
                status="failed",
                phase="failed",
                phase_label="Action failed",
                exit_code=1,
                extra_line=f"[error] {exc}",
            )

    def _run_shell_action(self, action_id: str, action_name: str) -> None:
        self._set_action_phase(action_id, "running", "Running shell workflow", blocking=True)
        try:
            if action_name == "open-logs":
                subprocess.Popen(["explorer.exe", str(self.logs_dir)], creationflags=CREATE_NO_WINDOW)
                self._finish_action(
                    action_id,
                    status="succeeded",
                    phase="succeeded",
                    phase_label="Action completed",
                    exit_code=0,
                    extra_line="[system] Opened logs folder.",
                )
                return

            process = subprocess.Popen(
                [
                    "powershell.exe",
                    "-NoProfile",
                    "-ExecutionPolicy",
                    "Bypass",
                    "-File",
                    str(MANAGE_SCRIPT),
                    "-OpsAction",
                    action_name,
                    "-Format",
                    "text",
                ],
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                cwd=str(self.root_dir),
                text=True,
                encoding="utf-8",
                errors="replace",
                creationflags=CREATE_NO_WINDOW,
            )
            assert process.stdout is not None
            for line in process.stdout:
                self._append_action_line(action_id, line.rstrip())
            exit_code = process.wait()
            phase = "succeeded" if exit_code == 0 else "failed"
            label = "Action completed" if exit_code == 0 else "Action failed"
            self._finish_action(action_id, status=phase, phase=phase, phase_label=label, exit_code=exit_code)
        except Exception as exc:
            self._finish_action(
                action_id,
                status="failed",
                phase="failed",
                phase_label="Action failed",
                exit_code=1,
                extra_line=f"[error] {exc}",
            )

    def _action_quartzy_stop(self, action_id: str) -> None:
        self._set_action_phase(action_id, "running", "Stopping Quartzy services", blocking=True)
        self._append_action_line(action_id, "[quartzy] Stopping frontend, backend, and DYMO.")
        self._stop_quartzy_services()
        if not wait_for(lambda: self._quartzy_core_is_stopped(), timeout=12.0, interval=0.25):
            raise RuntimeError("Quartzy services did not stop cleanly.")
        self._set_action_phase(action_id, "core-complete", "Quartzy stopped", blocking=False)
        if self._find_quartzy_dymo_process() is not None:
            self._finish_action(
                action_id,
                status="failed",
                phase="failed",
                phase_label="Validation failed",
                exit_code=1,
                extra_line="[quartzy] Backend/frontend stopped, but DYMO is still running.",
            )
        else:
            self._finish_action(
                action_id,
                status="succeeded",
                phase="succeeded",
                phase_label="Validation complete",
                exit_code=0,
                extra_line="[quartzy] Validation confirmed all Quartzy services are stopped.",
            )

    def _action_quartzy_start(self, action_id: str) -> None:
        self._set_action_phase(action_id, "running", "Starting Quartzy services", blocking=True)
        if not (self.frontend_build_dir / "index.html").exists():
            raise RuntimeError(f"Frontend build output is missing: {self.frontend_build_dir / 'index.html'}")

        self._stop_quartzy_services()
        dymo_ok = True
        self._append_action_line(action_id, "[quartzy] Launching DYMO.")
        try:
            self._start_dymo()
        except Exception as exc:
            dymo_ok = False
            self._append_action_line(action_id, f"[warn] DYMO start did not complete cleanly: {exc}")
        self._append_action_line(action_id, "[quartzy] Launching backend.")
        self._start_backend()
        self._append_action_line(action_id, "[quartzy] Launching frontend.")
        self._start_frontend()

        if not wait_for(lambda: self._quartzy_core_is_running(), timeout=20.0, interval=0.25):
            raise RuntimeError("Quartzy services did not reach the core running state.")

        self._set_action_phase(action_id, "core-complete", "Quartzy started", blocking=False)
        self._append_action_line(action_id, "[quartzy] Core start complete. Running HTTP validation.")

        def validate() -> None:
            errors: list[str] = []
            backend_health = probe_http(self.backend_health_url, timeout=2.0)
            frontend_health = probe_http(self.frontend_url, timeout=2.0)
            ready = probe_http(self.backend_ready_url, timeout=2.0)
            if not backend_health["ok"]:
                errors.append("Backend /health/ probe failed.")
            if not ready["ok"]:
                errors.append("Backend /ready/ probe failed.")
            if not frontend_health["ok"]:
                errors.append("Frontend root probe failed.")
            elif "/static/js/main." not in frontend_health["content"]:
                errors.append("Frontend is not serving the production bundle.")
            if not dymo_ok:
                errors.append("DYMO agent did not start.")

            with self._lock:
                backend = self._components["quartzy-backend"]
                frontend = self._components["quartzy-frontend"]
                dymo = self._components["quartzy-dymo"]
                backend["health"] = {"ok": backend_health["ok"], "status": backend_health["status"]}
                frontend["health"] = {"ok": frontend_health["ok"], "status": frontend_health["status"]}
                backend["status"] = "running" if backend_health["ok"] else "unhealthy"
                backend["message"] = "Backend health check passed." if backend_health["ok"] else "Port is open but backend health check failed."
                frontend_ok = frontend_health["ok"] and "/static/js/main." in frontend_health["content"]
                frontend["status"] = "running" if frontend_ok else "unhealthy"
                frontend["message"] = "Serving the latest built frontend." if frontend_ok else "Frontend page probe failed."
                if not dymo_ok:
                    dymo["status"] = "failed"
                    dymo["message"] = "DYMO startup failed during validation."
                self._publish_locked()

            if errors:
                self._finish_action(
                    action_id,
                    status="failed",
                    phase="failed",
                    phase_label="Validation failed",
                    exit_code=1,
                    extra_line="[quartzy] " + " ".join(errors),
                )
            else:
                self._finish_action(
                    action_id,
                    status="succeeded",
                    phase="succeeded",
                    phase_label="Validation complete",
                    exit_code=0,
                    extra_line="[quartzy] Backend, readiness, and frontend validation all passed.",
                )

        threading.Thread(target=validate, name=f"validate-{action_id}", daemon=True).start()

    def _action_quartzy_restart(self, action_id: str) -> None:
        self._set_action_phase(action_id, "running", "Restarting Quartzy services", blocking=True)
        self._stop_quartzy_services()
        if not wait_for(lambda: self._quartzy_core_is_stopped(), timeout=12.0, interval=0.25):
            raise RuntimeError("Quartzy services did not stop cleanly before restart.")
        self._append_action_line(action_id, "[quartzy] Stop complete. Starting services again.")
        dymo_ok = True
        try:
            self._start_dymo()
        except Exception as exc:
            dymo_ok = False
            self._append_action_line(action_id, f"[warn] DYMO restart did not complete cleanly: {exc}")
        self._start_backend()
        self._start_frontend()

        if not wait_for(lambda: self._quartzy_core_is_running(), timeout=20.0, interval=0.25):
            raise RuntimeError("Quartzy services did not start after restart.")

        self._set_action_phase(action_id, "core-complete", "Quartzy restart core complete", blocking=False)
        if dymo_ok:
            self._finish_action(
                action_id,
                status="succeeded",
                phase="succeeded",
                phase_label="Validation complete",
                exit_code=0,
                extra_line="[quartzy] Restart completed and ports are listening.",
            )
        else:
            self._finish_action(
                action_id,
                status="failed",
                phase="failed",
                phase_label="Validation failed",
                exit_code=1,
                extra_line="[quartzy] Backend/frontend restarted, but DYMO did not come back.",
            )

    def _action_cellstorage_start(self, action_id: str) -> None:
        self._set_action_phase(action_id, "running", "Starting CellStorage", blocking=True)
        self._service_command("start", self.cellstorage_service_name)
        self._start_cellstorage_print_agent()
        if not wait_for(lambda: self._cellstorage_core_is_running(), timeout=15.0, interval=0.5):
            raise RuntimeError("CellStorage did not reach the running state.")
        self._set_action_phase(action_id, "core-complete", "CellStorage started", blocking=False)
        self._finish_action(
            action_id,
            status="succeeded",
            phase="succeeded",
            phase_label="Validation complete",
            exit_code=0,
            extra_line="[cellstorage] Service and print agent are running.",
        )

    def _action_cellstorage_stop(self, action_id: str) -> None:
        self._set_action_phase(action_id, "running", "Stopping CellStorage", blocking=True)
        self._service_command("stop", self.cellstorage_service_name)
        self._stop_cellstorage_print_processes()
        if not wait_for(lambda: not self._cellstorage_core_is_running(), timeout=15.0, interval=0.5):
            raise RuntimeError("CellStorage did not stop cleanly.")
        self._set_action_phase(action_id, "core-complete", "CellStorage stopped", blocking=False)
        self._finish_action(
            action_id,
            status="succeeded",
            phase="succeeded",
            phase_label="Validation complete",
            exit_code=0,
            extra_line="[cellstorage] Service and print agent are stopped.",
        )

    def _action_cellstorage_restart(self, action_id: str) -> None:
        self._set_action_phase(action_id, "running", "Restarting CellStorage", blocking=True)
        self._service_command("stop", self.cellstorage_service_name)
        self._stop_cellstorage_print_processes()
        wait_for(lambda: not self._cellstorage_core_is_running(), timeout=10.0, interval=0.5)
        self._service_command("start", self.cellstorage_service_name)
        self._start_cellstorage_print_agent()
        if not wait_for(lambda: self._cellstorage_core_is_running(), timeout=15.0, interval=0.5):
            raise RuntimeError("CellStorage did not start after restart.")
        self._set_action_phase(action_id, "core-complete", "CellStorage restart core complete", blocking=False)
        self._finish_action(
            action_id,
            status="succeeded",
            phase="succeeded",
            phase_label="Validation complete",
            exit_code=0,
            extra_line="[cellstorage] Restart completed.",
        )

    def _action_cellstorage_print_restart(self, action_id: str) -> None:
        self._set_action_phase(action_id, "running", "Restarting CellStorage print agent", blocking=True)
        self._stop_cellstorage_print_processes()
        self._start_cellstorage_print_agent()
        if not wait_for(lambda: self._find_cellstorage_print_process() is not None, timeout=12.0, interval=0.5):
            raise RuntimeError("CellStorage print agent did not come back.")
        self._set_action_phase(action_id, "core-complete", "Print agent restarted", blocking=False)
        self._finish_action(
            action_id,
            status="succeeded",
            phase="succeeded",
            phase_label="Validation complete",
            exit_code=0,
            extra_line="[cellstorage] Print agent restart completed.",
        )

    def _start_backend(self) -> None:
        self._spawn_manager_action("start-backend")
        if not wait_for(lambda: bool(self._listening_pids(self.backend_port)), timeout=15.0, interval=0.25):
            raise RuntimeError(f"Backend did not open port {self.backend_port}.")
        self._load_state_file()

    def _start_frontend(self) -> None:
        self._spawn_manager_action("start-frontend")
        if not wait_for(lambda: bool(self._listening_pids(self.frontend_port)), timeout=15.0, interval=0.25):
            raise RuntimeError(f"Frontend did not open port {self.frontend_port}.")
        self._load_state_file()

    def _start_dymo(self) -> None:
        self._spawn_manager_action("start-dymo")
        if not wait_for(lambda: self._find_quartzy_dymo_process() is not None, timeout=8.0, interval=0.25):
            raise RuntimeError("DYMO agent did not stay alive.")
        self._load_state_file()

    def _stop_quartzy_services(self) -> None:
        for service_name in ("frontend", "backend", "dymo"):
            self._stop_quartzy_service(service_name)

    def _stop_quartzy_service(self, service_name: str) -> None:
        component = self._components[self.service_defs[service_name]["id"]]
        candidate_pids: set[int] = set()
        for key in ("wrapperPid", "portPid"):
            value = component.get(key)
            if isinstance(value, int) and value > 0:
                candidate_pids.add(value)

        if service_name == "backend":
            candidate_pids.update(self._scan_owned_processes(self.service_defs["backend"]))
            candidate_pids.update(self._listening_pids(self.backend_port))
        elif service_name == "frontend":
            candidate_pids.update(self._scan_owned_processes(self.service_defs["frontend"]))
            candidate_pids.update(self._listening_pids(self.frontend_port))
        else:
            candidate_pids.update(self._scan_quartzy_dymo_pids())

        for pid in sorted(candidate_pids):
            self._stop_process_tree(pid)

        if self.service_defs[service_name]["port"]:
            wait_for(lambda: not self._listening_pids(self.service_defs[service_name]["port"]), timeout=10.0, interval=0.25)

        self._persist_service_entry(service_name, None)
        with self._lock:
            component["wrapperPid"] = None
            component["portPid"] = None
            component["startedAt"] = None
            component["status"] = "stopped"
            component["message"] = "Stopped."
            component["health"] = None
            self._publish_locked()

    def _start_cellstorage_print_agent(self) -> None:
        self._stop_cellstorage_print_processes()
        task_result = subprocess.run(
            ["schtasks.exe", "/Run", "/TN", self.cellstorage_print_task_name],
            cwd=str(self.root_dir),
            capture_output=True,
            text=True,
            creationflags=CREATE_NO_WINDOW,
        )
        if task_result.returncode == 0:
            return

        fallback = self.cellstorage_root / "dymo-print-server-nodejs" / "start_print_agent_service.bat"
        if not fallback.exists():
            raise RuntimeError(f"CellStorage print agent entrypoint not found: {fallback}")
        subprocess.Popen([str(fallback)], cwd=str(fallback.parent), creationflags=CREATE_NO_WINDOW)

    def _stop_cellstorage_print_processes(self) -> None:
        candidates = self._scan_processes_by_text(
            markers=("production_print_agent.py", "dymo-print-server-nodejs"),
            path_markers=(str(self.cellstorage_root).lower(),),
        )
        for pid in candidates:
            self._stop_process_tree(pid)

    def _service_command(self, verb: str, service_name: str) -> None:
        result = subprocess.run(
            ["sc.exe", verb, service_name],
            cwd=str(self.root_dir),
            capture_output=True,
            text=True,
            creationflags=CREATE_NO_WINDOW,
        )
        stdout = (result.stdout or "") + (result.stderr or "")
        if result.returncode != 0 and "1062" not in stdout and "1060" not in stdout:
            raise RuntimeError(stdout.strip() or f"sc.exe {verb} failed")

    def _run_manager_action(self, action: str, failure_prefix: str) -> None:
        result = subprocess.run(
            [
                "powershell.exe",
                "-NoProfile",
                "-ExecutionPolicy",
                "Bypass",
                "-File",
                str(self.local_manager_script),
                "-Action",
                action,
            ],
            cwd=str(self.root_dir),
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            creationflags=CREATE_NO_WINDOW,
        )
        if result.returncode != 0:
            stdout = (result.stdout or result.stderr or "").strip().splitlines()
            detail = stdout[-1] if stdout else failure_prefix
            raise RuntimeError(f"{failure_prefix}: {detail}")

    def _spawn_manager_action(self, action: str) -> None:
        subprocess.Popen(
            [
                "powershell.exe",
                "-NoProfile",
                "-ExecutionPolicy",
                "Bypass",
                "-File",
                str(self.local_manager_script),
                "-Action",
                action,
            ],
            cwd=str(self.root_dir),
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            creationflags=CREATE_NO_WINDOW,
        )

    def _launch_background_process(self, service_name: str, working_dir: Path, command: str, log_file: Path) -> dict[str, Any]:
        self.logs_dir.mkdir(parents=True, exist_ok=True)
        self.state_dir.mkdir(parents=True, exist_ok=True)
        self._write_log_banner(log_file, command)
        cmd_line = f'cd /d "{working_dir}" && {command} >> "{log_file}" 2>&1'
        process = subprocess.Popen(
            ["cmd.exe", "/d", "/c", cmd_line],
            cwd=str(self.root_dir),
            env=self._build_process_env(),
            creationflags=CREATE_NO_WINDOW,
        )
        time.sleep(0.4)
        return {
            "Name": service_name,
            "WrapperPid": process.pid,
            "PortPid": None,
            "Port": self.service_defs[service_name]["port"],
            "LogFile": str(log_file),
            "StartedAt": now_iso(),
        }

    def _build_process_env(self) -> dict[str, str]:
        env = os.environ.copy()
        env.update(self.env_values)
        env.setdefault("REACT_APP_API_BASE_URL", "auto")
        env.setdefault("REACT_APP_API_URL", "auto")
        return env

    def _prepare_log_file(self, preferred: Path) -> Path:
        preferred.parent.mkdir(parents=True, exist_ok=True)
        try:
            preferred.open("a", encoding="utf-8").close()
            return preferred
        except OSError:
            timestamp = time.strftime("%Y%m%d-%H%M%S")
            return preferred.with_name(f"{preferred.stem}-{timestamp}{preferred.suffix}")

    def _write_log_banner(self, path: Path, command: str) -> None:
        with path.open("a", encoding="utf-8", errors="replace") as handle:
            handle.write("==================================================\n")
            handle.write(f"[{now_iso()}] {command}\n")
            handle.write("==================================================\n")

    def _listening_pids(self, port: int) -> list[int]:
        pids: set[int] = set()
        for conn in psutil.net_connections(kind="tcp"):
            if conn.status == psutil.CONN_LISTEN and conn.laddr and conn.laddr.port == port and conn.pid:
                pids.add(int(conn.pid))
        return sorted(pids)

    def _scan_processes_by_text(self, markers: tuple[str, ...], path_markers: tuple[str, ...]) -> set[int]:
        matches: set[int] = set()
        for proc in psutil.process_iter(["pid", "cmdline"]):
            try:
                if self._process_matches(proc, markers, path_markers):
                    matches.add(int(proc.pid))
            except (psutil.NoSuchProcess, psutil.AccessDenied):
                continue
        return matches

    def _scan_owned_processes(self, definition: dict[str, Any]) -> set[int]:
        return self._scan_processes_by_text(definition["markers"], definition["path_markers"])

    def _scan_quartzy_dymo_pids(self) -> set[int]:
        matches: set[int] = set()
        root_marker = str(self.dymo_dir).lower()
        for proc in psutil.process_iter(["pid", "cmdline"]):
            try:
                joined = " ".join(self._process_text_chain(proc)).lower()
            except (psutil.NoSuchProcess, psutil.AccessDenied):
                continue
            if root_marker in joined and ("production_print_agent.py" in joined or "start_print_agent.bat" in joined):
                matches.add(int(proc.pid))
        return matches

    def _process_matches(self, proc: psutil.Process, markers: tuple[str, ...], path_markers: tuple[str, ...]) -> bool:
        blobs = self._process_text_chain(proc)
        if not blobs:
            return False
        joined = " ".join(blobs).lower()
        return all(marker.lower() in joined for marker in markers) and all(path.lower() in joined for path in path_markers)

    def _process_text_chain(self, proc: psutil.Process) -> list[str]:
        blobs: list[str] = []
        current: psutil.Process | None = proc
        hops = 0
        while current is not None and hops < 5:
            hops += 1
            try:
                cmdline = " ".join(current.cmdline()).strip()
                if cmdline:
                    blobs.append(cmdline)
                try:
                    cwd = current.cwd()
                except (psutil.NoSuchProcess, psutil.AccessDenied, FileNotFoundError):
                    cwd = None
                if cwd:
                    blobs.append(cwd)
                current = current.parent()
            except (psutil.NoSuchProcess, psutil.AccessDenied):
                break
        return blobs

    def _find_quartzy_dymo_process(self) -> psutil.Process | None:
        for pid in self._scan_quartzy_dymo_pids():
            try:
                return psutil.Process(pid)
            except psutil.Error:
                continue
        return None

    def _find_cellstorage_print_process(self) -> psutil.Process | None:
        for pid in self._scan_processes_by_text(
            markers=("production_print_agent.py",),
            path_markers=(str(self.cellstorage_root).lower(),),
        ):
            try:
                return psutil.Process(pid)
            except psutil.Error:
                continue
        return None

    def _quartzy_core_is_running(self) -> bool:
        return bool(self._listening_pids(self.backend_port)) and bool(self._listening_pids(self.frontend_port))

    def _quartzy_core_is_stopped(self) -> bool:
        return not self._listening_pids(self.backend_port) and not self._listening_pids(self.frontend_port)

    def _cellstorage_core_is_running(self) -> bool:
        return bool(self._listening_pids(self.cellstorage_port)) and self._find_cellstorage_print_process() is not None

    def _stop_process_tree(self, pid: int) -> None:
        if not isinstance(pid, int) or pid <= 0:
            return

        taskkill = subprocess.run(
            ["taskkill.exe", "/PID", str(pid), "/T", "/F"],
            cwd=str(self.root_dir),
            capture_output=True,
            text=True,
            creationflags=CREATE_NO_WINDOW,
        )
        if taskkill.returncode == 0:
            return

        try:
            root = psutil.Process(pid)
            processes = root.children(recursive=True)
            processes.append(root)
        except psutil.Error:
            return

        for proc in reversed(processes):
            try:
                proc.kill()
            except psutil.Error:
                continue
        try:
            psutil.wait_procs(processes, timeout=2.0)
        except psutil.Error:
            return

    def _read_windows_service(self, name: str) -> dict[str, Any] | None:
        try:
            return psutil.win_service_get(name).as_dict()
        except Exception:
            return None

    def _query_scheduled_task(self, task_name: str) -> tuple[bool, str]:
        result = subprocess.run(
            ["schtasks.exe", "/Query", "/TN", task_name, "/FO", "LIST", "/V"],
            cwd=str(self.root_dir),
            capture_output=True,
            text=True,
            creationflags=CREATE_NO_WINDOW,
        )
        if result.returncode != 0:
            return False, "Missing"
        for line in result.stdout.splitlines():
            if ":" not in line:
                continue
            key, value = line.split(":", 1)
            if key.strip().lower() == "status":
                return True, value.strip()
        return True, "Ready"

    def _build_initial_components(self) -> dict[str, dict[str, Any]]:
        return {
            "quartzy-backend": {"id": "quartzy-backend", "project": "quartzy", "name": "Backend API", "serviceKey": "backend", "status": "stopped", "message": "Stopped.", "wrapperPid": None, "portPid": None, "port": self.backend_port, "portPids": [], "url": f"http://127.0.0.1:{self.backend_port}", "startedAt": None, "logFile": str(self.logs_dir / "backend.log"), "health": None},
            "quartzy-frontend": {"id": "quartzy-frontend", "project": "quartzy", "name": "Frontend Static Server", "serviceKey": "frontend", "status": "stopped", "message": "Stopped.", "wrapperPid": None, "portPid": None, "port": self.frontend_port, "portPids": [], "url": f"http://127.0.0.1:{self.frontend_port}", "startedAt": None, "logFile": str(self.logs_dir / "frontend-serve.log"), "health": None},
            "quartzy-dymo": {"id": "quartzy-dymo", "project": "quartzy", "name": "DYMO Agent", "serviceKey": "dymo", "status": "stopped", "message": "Stopped.", "wrapperPid": None, "portPid": None, "port": None, "portPids": [], "url": None, "startedAt": None, "logFile": str(self.logs_dir / "dymo.log"), "health": None},
            "quartzy-ops-console": {"id": "quartzy-ops-console", "project": "quartzy", "name": "Ops Console", "serviceKey": "ops-console", "status": "running", "message": "Local control plane is reachable.", "wrapperPid": os.getpid(), "portPid": os.getpid(), "port": OPS_PORT, "portPids": [os.getpid()], "url": f"http://127.0.0.1:{OPS_PORT}", "startedAt": now_iso(), "logFile": str(self.ops_log_file), "health": {"ok": True, "status": 200}},
            "cellstorage-app": {"id": "cellstorage-app", "project": "cellstorage", "name": "CellStorage App", "serviceKey": "app", "status": "stopped", "message": "Service not running.", "wrapperPid": None, "portPid": None, "port": self.cellstorage_port, "portPids": [], "url": self.cellstorage_url.rstrip("/"), "startedAt": None, "logFile": str(self.cellstorage_app_log), "health": None},
            "cellstorage-print": {"id": "cellstorage-print", "project": "cellstorage", "name": "CellStorage Print Agent", "serviceKey": "print", "status": "idle", "message": "Print agent not running.", "wrapperPid": None, "portPid": None, "port": None, "portPids": [], "url": None, "startedAt": None, "logFile": str(self.cellstorage_print_log), "health": None},
        }

    def _load_state_file(self) -> None:
        if not self.state_file.exists():
            return
        try:
            parsed = json.loads(self.state_file.read_text(encoding="utf-8", errors="replace"))
        except json.JSONDecodeError:
            return
        for item in parsed.get("Services", []):
            name = item.get("Name")
            if name not in self.service_defs:
                continue
            component = self._components[self.service_defs[name]["id"]]
            component["wrapperPid"] = item.get("WrapperPid")
            component["portPid"] = item.get("PortPid")
            component["startedAt"] = item.get("StartedAt")
            component["logFile"] = item.get("LogFile") or component["logFile"]

    def _persist_service_entry(self, service_name: str, entry: dict[str, Any] | None) -> None:
        services: dict[str, dict[str, Any]] = {}
        if self.state_file.exists():
            try:
                parsed = json.loads(self.state_file.read_text(encoding="utf-8", errors="replace"))
                for item in parsed.get("Services", []):
                    name = item.get("Name")
                    if name:
                        services[name] = item
            except json.JSONDecodeError:
                services = {}

        if entry is None:
            services.pop(service_name, None)
        else:
            services[service_name] = entry

        payload = {"GeneratedAt": now_iso(), "Services": [services[name] for name in sorted(services.keys())]}
        self.state_dir.mkdir(parents=True, exist_ok=True)
        self.state_file.write_text(json.dumps(payload, indent=4), encoding="utf-8")

        component = self._components[self.service_defs[service_name]["id"]]
        if entry is None:
            component["wrapperPid"] = None
            component["portPid"] = None
            component["startedAt"] = None
        else:
            component["wrapperPid"] = entry.get("WrapperPid")
            component["portPid"] = entry.get("PortPid")
            component["startedAt"] = entry.get("StartedAt")
            component["logFile"] = entry.get("LogFile") or component["logFile"]
        with self._lock:
            self._publish_locked()

    def _adopt_existing_processes(self) -> None:
        backend = self._components["quartzy-backend"]
        frontend = self._components["quartzy-frontend"]
        dymo = self._components["quartzy-dymo"]

        backend_listeners = self._listening_pids(self.backend_port)
        if backend_listeners:
            backend["portPid"] = backend_listeners[0]
            backend["status"] = "running"
            backend["message"] = "Backend port is listening."
            backend["wrapperPid"] = backend["wrapperPid"] or backend_listeners[0]

        frontend_listeners = self._listening_pids(self.frontend_port)
        if frontend_listeners:
            frontend["portPid"] = frontend_listeners[0]
            frontend["status"] = "running"
            frontend["message"] = "Frontend port is listening."
            frontend["wrapperPid"] = frontend["wrapperPid"] or frontend_listeners[0]

        dymo_proc = self._find_quartzy_dymo_process()
        if dymo_proc is not None:
            dymo["wrapperPid"] = dymo_proc.pid
            dymo["status"] = "running"
            dymo["message"] = "DYMO agent process detected."
            dymo["startedAt"] = dymo["startedAt"] or now_iso()

        self._refresh_component_state(slow_lane=True)

    def _fast_monitor_loop(self) -> None:
        while not self._stop_event.is_set():
            self._refresh_component_state(slow_lane=False)
            self._stop_event.wait(1.0)

    def _slow_monitor_loop(self) -> None:
        while not self._stop_event.is_set():
            self._refresh_component_state(slow_lane=True)
            self._stop_event.wait(6.0)

    def _refresh_component_state(self, slow_lane: bool) -> None:
        with self._lock:
            current_dymo_pid = self._components["quartzy-dymo"].get("wrapperPid")
            current_cell_print_pid = self._components["cellstorage-print"].get("wrapperPid")

        backend_pids = self._listening_pids(self.backend_port)
        frontend_pids = self._listening_pids(self.frontend_port)
        ops_pids = self._listening_pids(OPS_PORT)
        cellstorage_pids = self._listening_pids(self.cellstorage_port)
        dymo_proc = self._find_quartzy_dymo_process() if slow_lane or current_dymo_pid is None else self._safe_process(current_dymo_pid)
        print_process = self._find_cellstorage_print_process() if slow_lane or current_cell_print_pid is None else self._safe_process(current_cell_print_pid)
        service = self._read_windows_service(self.cellstorage_service_name)
        task_exists = self._task_exists_cache
        task_state = self._task_state_cache
        if slow_lane:
            task_exists, task_state = self._query_scheduled_task(self.cellstorage_print_task_name)

        backend_health = probe_http(self.backend_health_url, timeout=1.5) if slow_lane and backend_pids else None
        frontend_health = probe_http(self.frontend_url, timeout=1.5) if slow_lane and frontend_pids else None
        cell_health = probe_http(self.cellstorage_url, timeout=1.5) if slow_lane and cellstorage_pids else None

        with self._lock:
            backend = self._components["quartzy-backend"]
            frontend = self._components["quartzy-frontend"]
            dymo = self._components["quartzy-dymo"]
            ops_console = self._components["quartzy-ops-console"]
            cell_app = self._components["cellstorage-app"]
            cell_print = self._components["cellstorage-print"]

            backend["portPids"] = backend_pids
            backend["portPid"] = backend_pids[0] if backend_pids else None
            backend["status"] = "running" if backend_pids else "stopped"
            backend["message"] = "Backend port is listening." if backend_pids else "Stopped."

            frontend["portPids"] = frontend_pids
            frontend["portPid"] = frontend_pids[0] if frontend_pids else None
            frontend["status"] = "running" if frontend_pids else "stopped"
            frontend["message"] = "Frontend is serving requests." if frontend_pids else "Stopped."

            ops_console["portPids"] = ops_pids or [os.getpid()]
            ops_console["portPid"] = ops_console["portPids"][0]
            ops_console["wrapperPid"] = os.getpid()

            if dymo_proc is not None:
                dymo["wrapperPid"] = dymo_proc.pid
                dymo["status"] = "running"
                dymo["message"] = "DYMO agent process detected."
            else:
                dymo["wrapperPid"] = None
                dymo["status"] = "stopped"
                dymo["message"] = "Stopped."

            cell_app["portPids"] = cellstorage_pids
            cell_app["portPid"] = cellstorage_pids[0] if cellstorage_pids else None
            if service is None:
                cell_app["status"] = "missing"
                cell_app["message"] = "Windows service is not registered."
            else:
                service_status = str(service.get("status", "")).lower()
                if service_status == "running" and cellstorage_pids:
                    cell_app["status"] = "running"
                    cell_app["message"] = "Windows service is running."
                elif service_status == "running":
                    cell_app["status"] = "unhealthy"
                    cell_app["message"] = "Service reports running, but port 5000 is not listening."
                else:
                    cell_app["status"] = "stopped"
                    cell_app["message"] = f"Windows service state: {service.get('status', 'Unknown')}"

            self._task_exists_cache = task_exists
            self._task_state_cache = task_state
            if print_process is not None:
                cell_print["wrapperPid"] = print_process.pid
                cell_print["status"] = "running"
                cell_print["message"] = "Print agent process detected."
            else:
                cell_print["wrapperPid"] = None
                cell_print["status"] = "idle" if task_exists else "missing"
                cell_print["message"] = f"Scheduled task state: {task_state}" if task_exists else "Print agent task is not registered."

            if slow_lane:
                backend["health"] = None if backend_health is None else {"ok": backend_health["ok"], "status": backend_health["status"]}
                frontend["health"] = None if frontend_health is None else {"ok": frontend_health["ok"], "status": frontend_health["status"]}
                cell_app["health"] = None if cell_health is None else {"ok": cell_health["ok"], "status": cell_health["status"]}

                if backend_pids:
                    backend["status"] = "running" if backend_health and backend_health["ok"] else "unhealthy"
                    backend["message"] = "Backend health check passed." if backend["status"] == "running" else "Port is open but backend health check failed."
                if frontend_pids:
                    frontend_ok = bool(frontend_health and frontend_health["ok"] and "/static/js/main." in frontend_health["content"])
                    frontend["status"] = "running" if frontend_ok else "unhealthy"
                    frontend["message"] = "Serving the latest built frontend." if frontend_ok else "Frontend page probe failed."

            self._publish_locked()

    def _safe_process(self, pid: Any) -> psutil.Process | None:
        if not isinstance(pid, int) or pid <= 0:
            return None
        try:
            return psutil.Process(pid)
        except psutil.Error:
            return None

    def _get_blocking_action_locked(self) -> dict[str, Any] | None:
        for action in self._active_actions.values():
            if action["blocking"]:
                return action
        return None

    def _new_action_locked(self, action_name: str, display_name: str, project: str) -> dict[str, Any]:
        self._action_counter += 1
        action_id = f"{action_name}-{self._action_counter}"
        action = {
            "id": action_id,
            "action": action_name,
            "name": display_name,
            "project": project,
            "status": "queued",
            "phase": "queued",
            "phaseLabel": "Queued",
            "blocking": True,
            "startedAt": now_iso(),
            "coreCompletedAt": None,
            "finishedAt": None,
            "lines": [f"[system] Accepted action: {display_name}"],
            "exitCode": None,
        }
        self._active_actions[action_id] = action
        self._publish_locked()
        return copy.deepcopy(action)

    def _append_action_line(self, action_id: str, line: str) -> None:
        with self._lock:
            action = self._active_actions.get(action_id)
            if action is None:
                return
            action["lines"].append(line)
            action["lines"] = action["lines"][-300:]
            self._publish_locked()

    def _set_action_phase(self, action_id: str, phase: str, phase_label: str, blocking: bool) -> None:
        with self._lock:
            action = self._active_actions.get(action_id)
            if action is None:
                return
            action["status"] = "running" if phase not in {"core-complete", "succeeded", "failed"} else phase
            action["phase"] = phase
            action["phaseLabel"] = phase_label
            action["blocking"] = blocking
            if phase == "core-complete":
                action["status"] = "core-complete"
                action["coreCompletedAt"] = now_iso()
            action["lines"].append(f"[phase] {phase_label}")
            action["lines"] = action["lines"][-300:]
            self._publish_locked()

    def _finish_action(self, action_id: str, *, status: str, phase: str, phase_label: str, exit_code: int, extra_line: str | None = None) -> None:
        with self._lock:
            action = self._active_actions.pop(action_id, None)
            if action is None:
                return
            action["status"] = status
            action["phase"] = phase
            action["phaseLabel"] = phase_label
            action["blocking"] = False
            action["finishedAt"] = now_iso()
            action["exitCode"] = exit_code
            if extra_line:
                action["lines"].append(extra_line)
            action["lines"].append(f"[system] Action finished with exit code {exit_code}")
            action["lines"] = action["lines"][-300:]
            self._action_history.appendleft(action)
            self._publish_locked()

    def _build_snapshot_locked(self) -> dict[str, Any]:
        quartzy_components = [copy.deepcopy(self._components["quartzy-backend"]), copy.deepcopy(self._components["quartzy-frontend"]), copy.deepcopy(self._components["quartzy-dymo"]), copy.deepcopy(self._components["quartzy-ops-console"])]
        cellstorage_components = [copy.deepcopy(self._components["cellstorage-app"]), copy.deepcopy(self._components["cellstorage-print"])]
        logs = [
            {"id": "quartzy-backend", "label": "Quartzy Backend", "path": quartzy_components[0]["logFile"]},
            {"id": "quartzy-backend-prep", "label": "Quartzy Backend Prep", "path": str(self.logs_dir / "backend-prep.log")},
            {"id": "quartzy-frontend-build", "label": "Quartzy Frontend Build", "path": str(self.logs_dir / "frontend-build.log")},
            {"id": "quartzy-frontend-serve", "label": "Quartzy Frontend Serve", "path": quartzy_components[1]["logFile"]},
            {"id": "quartzy-dymo", "label": "Quartzy DYMO", "path": quartzy_components[2]["logFile"]},
            {"id": "cellstorage-app", "label": "CellStorage App", "path": str(self.cellstorage_app_log)},
            {"id": "cellstorage-print", "label": "CellStorage Print", "path": str(self.cellstorage_print_log)},
            {"id": "quartzy-ops-console", "label": "Ops Console", "path": str(self.ops_log_file)},
        ]
        active_actions = [copy.deepcopy(item) for item in sorted(self._active_actions.values(), key=lambda value: value["startedAt"], reverse=True)]
        blocking = next((item for item in active_actions if item["blocking"]), None)
        return {
            "generatedAt": now_iso(),
            "projects": [{"id": "quartzy", "name": "Quartzy", "components": quartzy_components}, {"id": "cellstorage", "name": "CellStorage", "components": cellstorage_components}],
            "logs": logs,
            "system": {"rootDir": str(self.root_dir), "logsDir": str(self.logs_dir), "cellStorageRoot": str(self.cellstorage_root)},
            "actions": {"canInteract": blocking is None, "running": copy.deepcopy(active_actions[0]) if active_actions else None, "blocking": blocking, "active": active_actions, "history": [copy.deepcopy(item) for item in self._action_history]},
        }

    def _publish_locked(self, force: bool = False) -> None:
        next_snapshot = self._build_snapshot_locked()
        if force or next_snapshot != self._snapshot:
            self._snapshot = next_snapshot
            self._snapshot_version += 1
            self._status_changed.notify_all()


controller = RuntimeController()

app = FastAPI(title="Quartzy Local Ops Console", version="2.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://127.0.0.1:3210", f"http://localhost:{OPS_PORT}"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.mount("/assets", StaticFiles(directory=str(WEB_DIR)), name="assets")


def sse_log_stream(path: Path):
    position = 0
    backlog: list[str] = []
    if path.exists():
        try:
            backlog = path.read_text(encoding="utf-8", errors="replace").splitlines()[-120:]
        except OSError:
            backlog = []
        for line in backlog:
            yield f"data: {json.dumps({'line': line.lstrip(chr(65279))})}\n\n"
        position = path.stat().st_size
    else:
        yield f"data: {json.dumps({'line': 'Waiting for log file to appear...'})}\n\n"

    while True:
        try:
            if path.exists():
                size = path.stat().st_size
                if size < position:
                    position = 0
                if size > position:
                    with path.open("r", encoding="utf-8", errors="replace") as handle:
                        handle.seek(position)
                        chunk = handle.read()
                        position = handle.tell()
                    for line in chunk.splitlines():
                        yield f"data: {json.dumps({'line': line.lstrip(chr(65279))})}\n\n"
            time.sleep(1.0)
        except GeneratorExit:
            return
        except Exception as exc:  # pragma: no cover - defensive
            yield f"data: {json.dumps({'line': f'[stream-error] {exc}'})}\n\n"
            time.sleep(2.0)


@app.on_event("startup")
def on_startup() -> None:
    controller.start()


@app.on_event("shutdown")
def on_shutdown() -> None:
    controller.stop()


@app.get("/")
def index() -> FileResponse:
    return FileResponse(WEB_DIR / "index.html")


@app.get("/api/status")
def api_status() -> JSONResponse:
    return JSONResponse(controller.get_snapshot())


@app.get("/api/status/stream")
def api_status_stream() -> StreamingResponse:
    return StreamingResponse(controller.stream_status(), media_type="text/event-stream")


@app.get("/api/logs")
def api_logs() -> JSONResponse:
    return JSONResponse({"logs": controller.get_logs()})


@app.get("/api/logs/stream")
def api_log_stream(target: str = Query(...)) -> StreamingResponse:
    path = controller.get_log_path(target)
    if path is None:
        raise HTTPException(status_code=404, detail=f"Unknown log target: {target}")
    return StreamingResponse(sse_log_stream(path), media_type="text/event-stream")


@app.post("/api/actions/quartzy/start")
def api_quartzy_start() -> JSONResponse:
    return JSONResponse(controller.submit_action("quartzy-start"), status_code=202)


@app.post("/api/actions/quartzy/stop")
def api_quartzy_stop() -> JSONResponse:
    return JSONResponse(controller.submit_action("quartzy-stop"), status_code=202)


@app.post("/api/actions/quartzy/restart")
def api_quartzy_restart() -> JSONResponse:
    return JSONResponse(controller.submit_action("quartzy-restart"), status_code=202)


@app.post("/api/actions/quartzy/release")
def api_quartzy_release() -> JSONResponse:
    return JSONResponse(controller.submit_action("quartzy-release"), status_code=202)


@app.post("/api/actions/cellstorage/start")
def api_cellstorage_start() -> JSONResponse:
    return JSONResponse(controller.submit_action("cellstorage-start"), status_code=202)


@app.post("/api/actions/cellstorage/stop")
def api_cellstorage_stop() -> JSONResponse:
    return JSONResponse(controller.submit_action("cellstorage-stop"), status_code=202)


@app.post("/api/actions/cellstorage/restart")
def api_cellstorage_restart() -> JSONResponse:
    return JSONResponse(controller.submit_action("cellstorage-restart"), status_code=202)


@app.post("/api/actions/cellstorage/print-restart")
def api_cellstorage_print_restart() -> JSONResponse:
    return JSONResponse(controller.submit_action("cellstorage-print-restart"), status_code=202)


@app.post("/api/actions/system/repair-startup")
def api_repair_startup() -> JSONResponse:
    return JSONResponse(controller.submit_action("repair-startup"), status_code=202)


@app.post("/api/actions/system/open-logs")
def api_open_logs() -> JSONResponse:
    return JSONResponse(controller.submit_action("open-logs"), status_code=202)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="127.0.0.1", port=OPS_PORT)
