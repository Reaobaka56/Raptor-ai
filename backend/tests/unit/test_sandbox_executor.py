"""The docker backend's security flags, without needing Docker."""
import os

import pytest

from app.services import sandbox_executor as ex


def argv(monkeypatch=None, **env):
    for k, v in env.items():
        monkeypatch.setenv(k, v)
    return ex.build_docker_argv("echo hi", "/tmp/ws", "raptor-sbx-test")


def flag(a, name):
    return a[a.index(name) + 1]


def test_docker_argv_is_locked_down():
    a = ex.build_docker_argv("echo hi", "/tmp/ws", "n")
    assert flag(a, "--network") == "none"
    assert "--read-only" in a and flag(a, "--cap-drop") == "ALL"
    assert flag(a, "--security-opt") == "no-new-privileges"
    assert flag(a, "--user") == f"{os.getuid()}:{os.getgid()}"       # never root
    assert "--privileged" not in a and "--pid" not in a and "--net=host" not in a
    assert flag(a, "--memory") == flag(a, "--memory-swap")             # no swap escape hatch
    assert "/tmp/ws:/workspace:rw" in a and flag(a, "-w") == "/workspace"
    assert a[-3:] == ["sh", "-c", "echo hi"]
    assert [x for x in a if x == "-v"] == ["-v"]                       # exactly one mount


def test_only_the_workspace_is_mounted_no_docker_socket():
    a = ex.build_docker_argv("x", "/tmp/ws", "n")
    assert not any("docker.sock" in x for x in a)


def test_network_env_is_validated(monkeypatch):
    assert flag(argv(monkeypatch, SANDBOX_DOCKER_NETWORK="bridge"), "--network") == "bridge"
    assert flag(argv(monkeypatch, SANDBOX_DOCKER_NETWORK="host"), "--network") == "none"   # host rejected


def test_command_is_a_single_argv_element_not_shell_interpolated():
    nasty = "echo hi'; docker run --privileged evil #"
    a = ex.build_docker_argv(nasty, "/tmp/ws", "n")
    assert a[-1] == nasty and a.count("docker") == 1


def test_backend_selection(monkeypatch):
    monkeypatch.delenv("SANDBOX_BACKEND", raising=False)
    assert ex.backend_name() == "local" and ex.isolation_level() == "process"
    monkeypatch.setenv("SANDBOX_BACKEND", "DOCKER")
    assert ex.backend_name() == "docker" and ex.isolation_level() == "container"
    monkeypatch.setenv("SANDBOX_BACKEND", "firecracker")
    assert ex.backend_name() == "local"                                # unknown -> safe default


def test_require_isolation_refuses_local(monkeypatch, tmp_path):
    monkeypatch.setenv("SANDBOX_BACKEND", "local")
    monkeypatch.setenv("SANDBOX_REQUIRE_ISOLATION", "1")
    with pytest.raises(ex.SandboxIsolationUnavailable):
        ex.run_command_blocking("echo hi", str(tmp_path), "sid", 5)


def test_docker_backend_without_docker_fails_closed_not_open(monkeypatch, tmp_path):
    monkeypatch.setenv("SANDBOX_BACKEND", "docker")
    monkeypatch.setenv("PATH", "/nonexistent")                         # no docker CLI
    with pytest.raises(ex.SandboxIsolationUnavailable):
        ex.run_command_blocking("echo hi", str(tmp_path), "sid", 5)    # must NOT fall back to local


def test_local_backend_still_runs(monkeypatch, tmp_path):
    monkeypatch.delenv("SANDBOX_BACKEND", raising=False)
    monkeypatch.delenv("SANDBOX_REQUIRE_ISOLATION", raising=False)
    r = ex.run_command_blocking("echo hi", str(tmp_path), "sid", 5)
    assert r.stdout.strip() == "hi"
