"""Tests voor dependency_triage.py zonder netwerk: python -m pytest tools/ops (of python tools/ops/test_dependency_triage.py)."""

import os
import sys
import urllib.error

sys.path.insert(0, os.path.dirname(__file__))
import dependency_triage as t  # noqa: E402

BASE = {
    "DEP_NAMES": "next", "DEP_FROM": "16.0.1", "DEP_TO": "16.0.2", "DEP_ECOSYSTEM": "npm_and_yarn",
    "PR_TITLE": "Bump next from 16.0.1 to 16.0.2", "PR_BODY": "Bug fixes.",
    "PR_URL": "https://github.com/patrickdereuver98-lab/camperdashboard/pull/9",
}


def test_regel_patch_is_aanbevolen():
    r = t.triage({**BASE, "DEP_UPDATE_TYPE": "version-update:semver-patch"})
    assert r["category"] == "aanbevolen"
    assert r["ai_model"] is None
    assert r["ai_advice"].startswith("[regel, geen AI]")


def test_regel_beveiliging_is_kritiek():
    r = t.triage({**BASE, "DEP_UPDATE_TYPE": "version-update:semver-patch", "DEP_GHSA": "GHSA-abcd-1234-efgh"})
    assert r["category"] == "kritiek"


def test_major_nooit_kritiek_ook_als_ai_dat_zegt():
    orig = t.ask_gemini
    t.ask_gemini = lambda key, prompt: ("kritiek", "Lek gedicht.")
    try:
        r = t.triage({**BASE, "DEP_UPDATE_TYPE": "version-update:semver-major", "GEMINI_API_KEY": "x"})
    finally:
        t.ask_gemini = orig
    assert r["category"] == "aanbevolen"
    assert "niet automatisch" in r["ai_advice"]
    assert r["ai_model"] == t.MODEL


def test_ai_fout_valt_terug_op_regel():
    def boom(key, prompt):
        raise urllib.error.URLError("weg")
    orig = t.ask_gemini
    t.ask_gemini = boom
    try:
        r = t.triage({**BASE, "DEP_UPDATE_TYPE": "version-update:semver-minor", "GEMINI_API_KEY": "x"})
    finally:
        t.ask_gemini = orig
    assert r["category"] == "aanbevolen"
    assert r["ai_advice"].startswith("[regel, AI faalde]")
    assert r["ai_model"] is None


def test_update_type():
    assert t.update_type("version-update:semver-minor") == "minor"
    assert t.update_type("") == "onbekend"


if __name__ == "__main__":
    for name, fn in list(globals().items()):
        if name.startswith("test_"):
            fn()
    print("dependency_triage: alle tests geslaagd")
