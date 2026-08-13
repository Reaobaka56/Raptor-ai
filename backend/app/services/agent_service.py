"""
Agent Service — CRUD and lifecycle management for AI agents.

Handles agent creation, configuration, status transitions,
and built-in role templates.
"""
import json
import logging
import os
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from .db import get_conn, release_conn, row_to_dict as _row_to_dict

logger = logging.getLogger(__name__)

# ── Built-in Agent Templates ──────────────────────────────────────────────────

AGENT_TEMPLATES: Dict[str, Dict[str, Any]] = {
    "project_manager": {
        "name": "Project Manager",
        "role": "project_manager",
        "description": "Breaks large tasks into smaller tasks, assigns work to agents, tracks progress, detects blockers, reviews outputs, and coordinates dependencies.",
        "system_prompt": (
            "You are a senior project manager for a software engineering team.\n\n"
            "Your responsibilities:\n"
            "- Break large objectives into manageable tasks\n"
            "- Assign tasks to the most appropriate team member\n"
            "- Track progress and detect blockers early\n"
            "- Review agent outputs for quality and completeness\n"
            "- Resolve conflicts between agents\n"
            "- Coordinate task dependencies\n"
            "- Decide when work is ready for human review\n\n"
            "Always provide clear, actionable task descriptions.\n"
            "Prioritize unblocking other agents over starting new work."
        ),
        "tools": ["file_read", "command_exec", "git_ops"],
        "permissions": {"can_commit": False, "requires_approval": True},
    },
    "ui_ux": {
        "name": "UI/UX Agent",
        "role": "ui_ux",
        "description": "Handles UI design, UX improvements, component architecture, accessibility, responsive design, visual consistency, and frontend implementation.",
        "system_prompt": (
            "You are a senior UI/UX engineer.\n\n"
            "Your responsibilities:\n"
            "- Design intuitive, accessible user interfaces\n"
            "- Implement responsive layouts and components\n"
            "- Ensure visual consistency across the application\n"
            "- Follow accessibility best practices (WCAG 2.1 AA)\n"
            "- Write clean, reusable component code\n"
            "- Optimize for performance and user experience\n\n"
            "Prioritize user experience over visual complexity.\n"
            "Always consider mobile-first responsive design."
        ),
        "tools": ["file_read", "file_write", "command_exec", "install_deps", "lint", "build"],
        "permissions": {"can_commit": False, "requires_approval": True, "allowed_paths": ["src/", "public/", "styles/"]},
    },
    "software_engineer": {
        "name": "Software Engineer",
        "role": "software_engineer",
        "description": "Backend and frontend development, APIs, database logic, architecture, debugging, testing, and refactoring.",
        "system_prompt": (
            "You are a senior software engineer.\n\n"
            "Your responsibilities:\n"
            "- Write maintainable, well-tested code\n"
            "- Follow SOLID principles where appropriate\n"
            "- Write tests for important functionality\n"
            "- Avoid unnecessary dependencies\n"
            "- Inspect existing architecture before modifying it\n"
            "- Never overwrite existing functionality without understanding it\n"
            "- Explain significant architectural decisions\n\n"
            "Write code that is clear enough to be understood without comments.\n"
            "Prefer simplicity over cleverness."
        ),
        "tools": ["file_read", "file_write", "command_exec", "git_ops", "install_deps", "run_tests", "lint", "build"],
        "permissions": {"can_commit": False, "requires_approval": True},
    },
    "qa_tester": {
        "name": "QA Agent",
        "role": "qa_tester",
        "description": "Writes tests, identifies edge cases, validates implementations, runs test suites, and reports test coverage.",
        "system_prompt": (
            "You are a senior QA engineer.\n\n"
            "Your responsibilities:\n"
            "- Write comprehensive test suites (unit, integration, e2e)\n"
            "- Identify edge cases and failure modes\n"
            "- Validate implementations against requirements\n"
            "- Report test coverage gaps\n"
            "- Verify bug fixes don't introduce regressions\n\n"
            "Think adversarially — look for what could go wrong.\n"
            "Prioritize tests for critical paths and security-sensitive code."
        ),
        "tools": ["file_read", "file_write", "command_exec", "run_tests", "lint"],
        "permissions": {"can_commit": False, "requires_approval": True, "allowed_paths": ["tests/", "test/", "spec/", "__tests__/"]},
    },
    "security": {
        "name": "Security Agent",
        "role": "security",
        "description": "Security auditing, vulnerability detection, dependency scanning, access control review, and secure coding guidance.",
        "system_prompt": (
            "You are a senior security engineer.\n\n"
            "Your responsibilities:\n"
            "- Audit code for security vulnerabilities\n"
            "- Review authentication and authorization logic\n"
            "- Check for common vulnerabilities (OWASP Top 10)\n"
            "- Scan dependencies for known CVEs\n"
            "- Verify proper input validation and sanitization\n"
            "- Ensure secrets are not hardcoded\n\n"
            "Assume all input is malicious until proven otherwise.\n"
            "Report findings with severity, impact, and remediation steps."
        ),
        "tools": ["file_read", "command_exec", "run_tests"],
        "permissions": {"can_commit": False, "requires_approval": True},
    },
    "devops": {
        "name": "DevOps Agent",
        "role": "devops",
        "description": "CI/CD pipelines, deployment configuration, infrastructure, Docker, monitoring, and environment management.",
        "system_prompt": (
            "You are a senior DevOps engineer.\n\n"
            "Your responsibilities:\n"
            "- Configure CI/CD pipelines\n"
            "- Manage deployment configurations\n"
            "- Write and maintain Dockerfiles\n"
            "- Set up monitoring and alerting\n"
            "- Manage environment variables and secrets\n"
            "- Optimize build performance\n\n"
            "Prefer declarative configuration over imperative scripts.\n"
            "Always consider security in deployment pipelines."
        ),
        "tools": ["file_read", "file_write", "command_exec", "git_ops", "build"],
        "permissions": {"can_commit": False, "requires_approval": True},
    },
    "code_review": {
        "name": "Code Review Agent",
        "role": "code_review",
        "description": "Reviews code changes for quality, consistency, best practices, and potential issues.",
        "system_prompt": (
            "You are a senior code reviewer.\n\n"
            "Your responsibilities:\n"
            "- Review code changes for correctness and quality\n"
            "- Check for consistency with project conventions\n"
            "- Identify potential bugs and edge cases\n"
            "- Suggest improvements without being pedantic\n"
            "- Verify test coverage for changes\n"
            "- Check for performance implications\n\n"
            "Be constructive and specific in feedback.\n"
            "Distinguish between must-fix issues and nice-to-have suggestions."
        ),
        "tools": ["file_read", "command_exec", "git_ops", "run_tests", "lint"],
        "permissions": {"can_commit": False, "requires_approval": True},
    },
    "documentation": {
        "name": "Documentation Agent",
        "role": "documentation",
        "description": "Writes and maintains documentation, README files, API docs, inline comments, and architecture decision records.",
        "system_prompt": (
            "You are a technical writer and documentation specialist.\n\n"
            "Your responsibilities:\n"
            "- Write clear, accurate documentation\n"
            "- Maintain README and getting-started guides\n"
            "- Document API endpoints and data models\n"
            "- Create architecture decision records\n"
            "- Keep documentation in sync with code changes\n\n"
            "Write for the reader, not for yourself.\n"
            "Include examples wherever possible."
        ),
        "tools": ["file_read", "file_write", "command_exec"],
        "permissions": {"can_commit": False, "requires_approval": True, "allowed_paths": ["docs/", "*.md", "README*"]},
    },
    "research": {
        "name": "Research Agent",
        "role": "research",
        "description": "Investigates technical solutions, evaluates libraries, benchmarks approaches, and provides recommendations.",
        "system_prompt": (
            "You are a senior technical researcher.\n\n"
            "Your responsibilities:\n"
            "- Investigate technical solutions for given problems\n"
            "- Evaluate libraries, frameworks, and tools\n"
            "- Benchmark alternative approaches\n"
            "- Provide well-reasoned recommendations\n"
            "- Document findings with references\n\n"
            "Base recommendations on evidence, not opinion.\n"
            "Always consider trade-offs and long-term maintenance."
        ),
        "tools": ["file_read", "command_exec", "network"],
        "permissions": {"can_commit": False, "requires_approval": True},
    },
}

# ── Valid status transitions ──────────────────────────────────────────────────

VALID_STATUS_TRANSITIONS = {
    "idle":       ["planning", "working", "paused"],
    "planning":   ["working", "waiting", "idle", "failed", "paused"],
    "working":    ["waiting", "reviewing", "completed", "failed", "paused", "idle"],
    "waiting":    ["working", "reviewing", "failed", "paused", "idle"],
    "reviewing":  ["working", "completed", "failed", "paused", "idle"],
    "completed":  ["idle"],
    "failed":     ["idle", "planning"],
    "paused":     ["idle", "planning", "working", "waiting"],
}

ALL_TOOLS = [
    "file_read", "file_write", "command_exec", "git_ops",
    "network", "install_deps", "run_tests", "lint", "build",
    "start_dev_server", "inspect_logs", "commit_changes",
]


# ── DB helpers ────────────────────────────────────────────────────────────────



def _log_activity(owner_id: str, agent_id: Optional[str], activity_type: str,
                  description: str, metadata: dict = None) -> None:
    """Write an entry to the agent activity log. Best-effort."""
    conn = get_conn()
    if not conn:
        return
    try:
        with conn.cursor() as cur:
            cur.execute(
                """INSERT INTO agent_activity_log
                       (owner_id, agent_id, activity_type, description, metadata)
                   VALUES (%s::uuid, %s::uuid, %s, %s, %s::jsonb)""",
                (owner_id, agent_id, activity_type, description,
                 json.dumps(metadata or {})),
            )
            conn.commit()
    except Exception:
        try:
            conn.rollback()
        except Exception:
            pass
    finally:
        release_conn(conn)


# ── CRUD ──────────────────────────────────────────────────────────────────────

def create_agent(owner_id: str, data: Dict[str, Any]) -> Dict[str, Any]:
    """Create a new agent. Returns the created agent dict."""
    conn = get_conn()
    if not conn:
        raise RuntimeError("Database unavailable")
    try:
        with conn.cursor() as cur:
            cur.execute(
                """INSERT INTO agents
                       (owner_id, name, role, description, system_prompt,
                        model, provider, tools, permissions, config, knowledge_sources)
                   VALUES (%s::uuid, %s, %s, %s, %s, %s, %s,
                           %s::jsonb, %s::jsonb, %s::jsonb, %s::jsonb)
                   RETURNING id, owner_id, name, role, description, system_prompt,
                             model, provider, tools, permissions, status,
                             sandbox_id, current_task_id, config, knowledge_sources,
                             created_at, updated_at""",
                (
                    owner_id,
                    data.get("name", "Untitled Agent"),
                    data.get("role", "custom"),
                    data.get("description"),
                    data.get("system_prompt"),
                    data.get("model", "gemini-2.5-pro"),
                    data.get("provider", "google"),
                    json.dumps(data.get("tools", [])),
                    json.dumps(data.get("permissions", {})),
                    json.dumps(data.get("config", {})),
                    json.dumps(data.get("knowledge_sources", [])),
                ),
            )
            conn.commit()
            agent = _row_to_dict(cur, cur.fetchone())

            _log_activity(owner_id, agent["id"], "system",
                          f"Agent '{agent['name']}' created with role '{agent['role']}'")
            return agent
    except Exception:
        try:
            conn.rollback()
        except Exception:
            pass
        raise
    finally:
        release_conn(conn)


def get_agent(agent_id: str, owner_id: str) -> Optional[Dict[str, Any]]:
    """Get a single agent by ID."""
    conn = get_conn()
    if not conn:
        return None
    try:
        with conn.cursor() as cur:
            cur.execute(
                """SELECT id, owner_id, name, role, description, system_prompt,
                          model, provider, tools, permissions, status,
                          sandbox_id, current_task_id, config, knowledge_sources,
                          created_at, updated_at
                   FROM agents
                   WHERE id = %s::uuid AND owner_id = %s::uuid""",
                (agent_id, owner_id),
            )
            return _row_to_dict(cur, cur.fetchone())
    finally:
        release_conn(conn)


def list_agents(owner_id: str) -> List[Dict[str, Any]]:
    """List all agents for an owner."""
    conn = get_conn()
    if not conn:
        return []
    try:
        with conn.cursor() as cur:
            cur.execute(
                """SELECT id, owner_id, name, role, description, system_prompt,
                          model, provider, tools, permissions, status,
                          sandbox_id, current_task_id, config, knowledge_sources,
                          created_at, updated_at
                   FROM agents
                   WHERE owner_id = %s::uuid
                   ORDER BY created_at DESC
                   LIMIT 100""",
                (owner_id,),
            )
            rows = cur.fetchall()
            return [_row_to_dict(cur, row) for row in rows]
    finally:
        release_conn(conn)


def update_agent(agent_id: str, owner_id: str, data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """Update agent fields. Only provided fields are updated."""
    allowed_fields = {
        "name", "role", "description", "system_prompt", "model", "provider",
        "tools", "permissions", "config", "knowledge_sources",
    }
    updates = {k: v for k, v in data.items() if k in allowed_fields}
    if not updates:
        return get_agent(agent_id, owner_id)

    conn = get_conn()
    if not conn:
        return None
    try:
        set_parts = []
        values = []
        for key, val in updates.items():
            if key in ("tools", "permissions", "config", "knowledge_sources"):
                set_parts.append(f"{key} = %s::jsonb")
                values.append(json.dumps(val))
            else:
                set_parts.append(f"{key} = %s")
                values.append(val)
        set_parts.append("updated_at = now()")
        values.extend([agent_id, owner_id])

        with conn.cursor() as cur:
            cur.execute(
                f"""UPDATE agents SET {', '.join(set_parts)}
                    WHERE id = %s::uuid AND owner_id = %s::uuid
                    RETURNING id, owner_id, name, role, description, system_prompt,
                              model, provider, tools, permissions, status,
                              sandbox_id, current_task_id, config, knowledge_sources,
                              created_at, updated_at""",
                values,
            )
            conn.commit()
            return _row_to_dict(cur, cur.fetchone())
    except Exception:
        try:
            conn.rollback()
        except Exception:
            pass
        raise
    finally:
        release_conn(conn)


def update_agent_status(agent_id: str, owner_id: str, new_status: str) -> Optional[Dict[str, Any]]:
    """Transition agent to a new status with validation."""
    agent = get_agent(agent_id, owner_id)
    if not agent:
        return None

    current = agent["status"]
    valid_next = VALID_STATUS_TRANSITIONS.get(current, [])
    if new_status not in valid_next:
        raise ValueError(
            f"Cannot transition from '{current}' to '{new_status}'. "
            f"Valid transitions: {valid_next}"
        )

    conn = get_conn()
    if not conn:
        return None
    try:
        with conn.cursor() as cur:
            cur.execute(
                """UPDATE agents SET status = %s, updated_at = now()
                   WHERE id = %s::uuid AND owner_id = %s::uuid
                   RETURNING id, owner_id, name, role, description, system_prompt,
                             model, provider, tools, permissions, status,
                             sandbox_id, current_task_id, config, knowledge_sources,
                             created_at, updated_at""",
                (new_status, agent_id, owner_id),
            )
            conn.commit()
            result = _row_to_dict(cur, cur.fetchone())

            _log_activity(owner_id, agent_id, "status_change",
                          f"Agent '{agent['name']}' status: {current} → {new_status}",
                          {"from": current, "to": new_status})
            return result
    except Exception:
        try:
            conn.rollback()
        except Exception:
            pass
        raise
    finally:
        release_conn(conn)


def delete_agent(agent_id: str, owner_id: str) -> bool:
    """Delete an agent. Returns True if deleted."""
    agent = get_agent(agent_id, owner_id)
    if not agent:
        return False

    conn = get_conn()
    if not conn:
        return False
    try:
        with conn.cursor() as cur:
            cur.execute(
                "DELETE FROM agents WHERE id = %s::uuid AND owner_id = %s::uuid",
                (agent_id, owner_id),
            )
            conn.commit()
            deleted = cur.rowcount > 0
            if deleted:
                _log_activity(owner_id, agent_id, "system",
                              f"Agent '{agent['name']}' deleted")
            return deleted
    except Exception:
        try:
            conn.rollback()
        except Exception:
            pass
        raise
    finally:
        release_conn(conn)


def get_agent_templates() -> Dict[str, Dict[str, Any]]:
    """Return built-in agent role templates."""
    return AGENT_TEMPLATES


def get_activity_log(owner_id: str, agent_id: Optional[str] = None,
                     limit: int = 100) -> List[Dict[str, Any]]:
    """Get recent activity log entries."""
    conn = get_conn()
    if not conn:
        return []
    try:
        with conn.cursor() as cur:
            if agent_id:
                cur.execute(
                    """SELECT id, owner_id, agent_id, activity_type, description,
                              metadata, created_at
                       FROM agent_activity_log
                       WHERE owner_id = %s::uuid AND agent_id = %s::uuid
                       ORDER BY created_at DESC
                       LIMIT %s""",
                    (owner_id, agent_id, limit),
                )
            else:
                cur.execute(
                    """SELECT id, owner_id, agent_id, activity_type, description,
                              metadata, created_at
                       FROM agent_activity_log
                       WHERE owner_id = %s::uuid
                       ORDER BY created_at DESC
                       LIMIT %s""",
                    (owner_id, limit),
                )
            rows = cur.fetchall()
            result = []
            cols = [d[0] for d in cur.description]
            for row in rows:
                d = dict(zip(cols, row))
                for key in ("id", "owner_id", "agent_id"):
                    if d.get(key):
                        d[key] = str(d[key])
                if d.get("created_at") and hasattr(d["created_at"], "isoformat"):
                    d["created_at"] = d["created_at"].isoformat()
                result.append(d)
            return result
    finally:
        release_conn(conn)
