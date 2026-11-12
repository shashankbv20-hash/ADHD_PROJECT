"""PDF export of saved reports. All data is synthetic."""

from datetime import UTC, datetime

from app.services.report_pdf import render_report_pdf
from tests.test_caregiver import CAREGIVER, OTHER, _share
from tests.test_data_rights import _populated_subject


def _first_report(client, headers, subject_id):
    return client.get(f"/api/v1/subjects/{subject_id}/reports", headers=headers).json()["items"][0]


def test_owner_downloads_a_valid_pdf_and_it_is_audited(test_app, participant_headers):
    _, client = test_app
    subject = _populated_subject(client, participant_headers)
    report = _first_report(client, participant_headers, subject["id"])

    response = client.get(
        f"/api/v1/subjects/{subject['id']}/reports/{report['id']}/pdf", headers=participant_headers
    )

    assert response.status_code == 200
    assert response.headers["content-type"] == "application/pdf"
    assert "attachment" in response.headers["content-disposition"]
    assert response.headers["cache-control"] == "no-store"
    body = response.content
    assert body.startswith(b"%PDF-1.4") and body.rstrip().endswith(b"%%EOF")
    assert b"Attune research report" in body
    assert b"not a diagnosis" in body

    log = client.get(f"/api/v1/subjects/{subject['id']}/audit-events", headers=participant_headers).json()
    assert any(item["action"] == "report_pdf_exported" for item in log["items"])


def test_pdf_does_not_contain_subject_or_user_identifiers(test_app, participant_headers):
    _, client = test_app
    subject = _populated_subject(client, participant_headers)
    report = _first_report(client, participant_headers, subject["id"])
    body = client.get(
        f"/api/v1/subjects/{subject['id']}/reports/{report['id']}/pdf", headers=participant_headers
    ).content
    assert subject["id"].encode() not in body
    assert b"participant-test-uid" not in body


def test_unknown_report_is_404_and_other_users_are_refused(test_app, participant_headers):
    _, client = test_app
    subject = _populated_subject(client, participant_headers)
    report = _first_report(client, participant_headers, subject["id"])
    url = f"/api/v1/subjects/{subject['id']}/reports/{report['id']}/pdf"

    assert client.get(url.replace(report["id"], "missing"), headers=participant_headers).status_code == 404
    assert client.get(url, headers=OTHER).status_code in (403, 404)
    assert client.get(url).status_code == 401


def test_caregiver_with_a_share_can_download_but_without_cannot(test_app, participant_headers):
    _, client = test_app
    subject = _populated_subject(client, participant_headers)
    report = _first_report(client, participant_headers, subject["id"])
    url = f"/api/v1/subjects/{subject['id']}/reports/{report['id']}/pdf"

    client.get("/api/v1/users/me", headers=CAREGIVER)
    assert client.get(url, headers=CAREGIVER).status_code in (403, 404)
    assert _share(client, participant_headers, subject["id"]).status_code == 201
    assert client.get(url, headers=CAREGIVER).status_code == 200


def test_renderer_paginates_and_escapes():
    report = {
        "id": "r(1)\\",
        "template_version": "v1",
        "created_at": datetime(2026, 1, 1, tzinfo=UTC),
        "content": {
            "summary_count": 2,
            "metrics": {"accuracy_percent": 91, "mean_hit_reaction_time_ms": None},
            "limitations": ["word " * 1500, "naïve — dash"],
        },
    }
    pdf = render_report_pdf(report)
    assert pdf.count(b"/Type /Page ") >= 2
    assert b"r\\(1\\)\\\\" in pdf
    assert b"not available" in pdf
