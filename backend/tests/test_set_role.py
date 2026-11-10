"""The trusted role-assignment tool (scripts/set_role.py): pure logic and safety checks."""

import importlib.util
from pathlib import Path

import pytest

_SPEC = importlib.util.spec_from_file_location(
    "set_role", Path(__file__).resolve().parent.parent / "scripts" / "set_role.py"
)
set_role = importlib.util.module_from_spec(_SPEC)
_SPEC.loader.exec_module(set_role)


def test_role_claim_is_set_and_other_claims_are_preserved():
    assert set_role.merged_claims({"beta": True}, "caregiver") == {"beta": True, "role": "caregiver"}
    assert set_role.merged_claims({"role": "clinician", "beta": 1}, "researcher") == {
        "role": "researcher",
        "beta": 1,
    }


def test_participant_means_no_role_claim():
    assert set_role.merged_claims({"role": "caregiver", "beta": 1}, "participant") == {"beta": 1}
    assert set_role.merged_claims(None, "participant") == {}


def test_input_is_not_mutated():
    existing = {"role": "caregiver"}
    set_role.merged_claims(existing, "clinician")
    assert existing == {"role": "caregiver"}


def test_only_known_roles_are_accepted():
    with pytest.raises(ValueError):
        set_role.apply_role(project="demo-x", uid="u", email=None, role="admin", revoke=False)


def test_exactly_one_of_uid_or_email_is_required():
    with pytest.raises(ValueError):
        set_role.apply_role(project="demo-x", uid=None, email=None, role="caregiver", revoke=False)
    with pytest.raises(ValueError):
        set_role.apply_role(project="demo-x", uid="u", email="a@example.test", role="caregiver", revoke=False)


def test_refuses_to_run_without_explicit_confirmation(capsys):
    exit_code = set_role.main(["--project", "demo-x", "--uid", "u", "--role", "caregiver"])

    assert exit_code == 2
    assert "--yes" in capsys.readouterr().err


def test_unknown_role_is_rejected_by_the_command_line_parser():
    with pytest.raises(SystemExit):
        set_role.main(["--project", "demo-x", "--uid", "u", "--role", "admin", "--yes"])
