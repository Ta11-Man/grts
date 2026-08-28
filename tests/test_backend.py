"""
Unit and Integration tests for GRTS Backend.
Tests database initialization, application insertion with Q&A responses,
timeline lifecycle events, profile synchronization, and analytics calculations.
"""
import unittest
import os
import sys
import tempfile
import json
from fastapi.testclient import TestClient

backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend"))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

import database
import main
from models import ApplicationCreate, TimelineEventCreate, UserProfileSchema

class TestGRTSBackend(unittest.TestCase):
    def setUp(self):
        # Create a temporary database for test isolation
        self.temp_db = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
        self.temp_db.close()
        database.DB_NAME = self.temp_db.name
        database.init_db()
        self.client = TestClient(main.app)

    def tearDown(self):
        # Clean up temporary database file
        if os.path.exists(self.temp_db.name):
            try:
                os.unlink(self.temp_db.name)
            except Exception:
                pass

    def test_health_check(self):
        """Test ping endpoint."""
        res = self.client.get("/ping")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()["status"], "ok")

    def test_application_lifecycle_and_qa_capture(self):
        """Test creating an application with custom non-standard questions, logging milestones, and querying Q&A bank."""
        payload = {
            "company_name": "Acme Robotics",
            "job_title": "Senior Systems Engineer",
            "location": "Boston, MA (Hybrid)",
            "date_applied": "2026-08-15",
            "url": "https://careers.acme.com/jobs/123",
            "notes": "Referred by John Doe",
            "resume_version": "Systems_v2.pdf",
            "job_description": "We are seeking a senior systems engineer to build autonomous robots.",
            "company_website": "https://acmerobotics.com",
            "company_logo": "https://acmerobotics.com/logo.png",
            "ats_job_id": "REQ-9876",
            "ats_platform": "workday",
            "salary_range": "$160,000 - $190,000",
            "workplace_type": "Hybrid",
            "job_type": "Full-time",
            "priority": 5,
            "custom_answers": [
                {
                    "question_text": "Describe your experience with ROS2 and real-time middleware.",
                    "answer_text": "Built real-time control loops in C++ using ROS2 Humble with DDS configuration.",
                    "field_type": "textarea"
                },
                {
                    "question_text": "What is your target total compensation?",
                    "answer_text": "$175,000 base + equity",
                    "field_type": "text"
                }
            ]
        }

        # 1. Submit Application
        create_res = self.client.post("/apply", json=payload)
        self.assertEqual(create_res.status_code, 200)
        app_id = create_res.json()["id"]
        self.assertIsInstance(app_id, int)

        # 2. Retrieve Application
        get_res = self.client.get(f"/applications/{app_id}")
        self.assertEqual(get_res.status_code, 200)
        app_data = get_res.json()["data"]
        self.assertEqual(app_data["company_name"], "Acme Robotics")
        self.assertEqual(app_data["job_title"], "Senior Systems Engineer")
        self.assertEqual(app_data["status"], "Applied")
        self.assertEqual(app_data["priority"], 5)
        self.assertEqual(len(app_data["timeline"]), 1)
        self.assertEqual(app_data["timeline"][0]["event_type"], "Applied")

        # Verify Q&A responses were captured
        self.assertEqual(len(app_data["custom_answers"]), 2)
        self.assertEqual(app_data["custom_answers"][0]["question_text"], "Describe your experience with ROS2 and real-time middleware.")

        # 3. Log Interview Milestone (Recruiter Screen)
        milestone1 = {
            "event_type": "Recruiter Screen",
            "event_date": "2026-08-18",
            "notes": "Went great! Recruiter loved the robotics background.",
            "round_number": 1,
            "interviewer_name": "Jane Smith",
            "interviewer_email": "jane@acmerobotics.com",
            "meeting_link": "https://meet.google.com/abc-xyz",
            "rating": 5
        }
        event_res1 = self.client.post(f"/applications/{app_id}/timeline", json=milestone1)
        self.assertEqual(event_res1.status_code, 200)

        # 4. Check Status Updated to Recruiter Screen
        get_res2 = self.client.get(f"/applications/{app_id}")
        app_data2 = get_res2.json()["data"]
        self.assertEqual(app_data2["status"], "Recruiter Screen")
        self.assertEqual(len(app_data2["timeline"]), 2)

        # 5. Log Next Milestone (Technical Interview)
        milestone2 = {
            "event_type": "Technical Interview",
            "event_date": "2026-08-22",
            "notes": "Live coding: multi-threaded queue implementation in C++.",
            "round_number": 2,
            "interviewer_name": "Bob Senior Architect",
            "rating": 4
        }
        event_res2 = self.client.post(f"/applications/{app_id}/timeline", json=milestone2)
        self.assertEqual(event_res2.status_code, 200)

        # Verify timeline updated
        get_res3 = self.client.get(f"/applications/{app_id}")
        app_data3 = get_res3.json()["data"]
        self.assertEqual(app_data3["status"], "Technical Interview")
        self.assertEqual(len(app_data3["timeline"]), 3)

        # 6. Verify Q&A Bank Endpoint & Editing
        qa_res = self.client.get("/questions?query=ROS2")
        self.assertEqual(qa_res.status_code, 200)
        qa_data = qa_res.json()["data"]
        self.assertEqual(len(qa_data), 1)
        self.assertIn("Built real-time control loops", qa_data[0]["answer_text"])
        self.assertEqual(qa_data[0]["company_name"], "Acme Robotics")
        qa_id = qa_data[0]["id"]

        # 6b. Test Updating Recorded Question Response
        update_qa_res = self.client.put(f"/questions/{qa_id}", json={
            "question_text": "Describe your ROS2 and Nav2 robotics experience:",
            "answer_text": "Engineered autonomous mobile robotics navigation and real-time control loops in ROS2."
        })
        self.assertEqual(update_qa_res.status_code, 200)

        # Verify updated in application details
        get_res4 = self.client.get(f"/applications/{app_id}")
        app_data4 = get_res4.json()["data"]
        self.assertEqual(app_data4["custom_answers"][0]["question_text"], "Describe your ROS2 and Nav2 robotics experience:")
        self.assertIn("autonomous mobile robotics navigation", app_data4["custom_answers"][0]["answer_text"])

        # 6c. Test Adding New Custom Question to Application
        add_qa_res = self.client.post(f"/applications/{app_id}/questions", json={
            "question_text": "Why Acme Robotics?",
            "answer_text": "Passionate about cutting-edge industrial mobile robotics."
        })
        self.assertEqual(add_qa_res.status_code, 200)
        new_qa_id = add_qa_res.json()["data"]["id"]

        # Verify 3 custom answers now exist (2 original + 1 newly added)
        get_res5 = self.client.get(f"/applications/{app_id}")
        self.assertEqual(len(get_res5.json()["data"]["custom_answers"]), 3)

        # 7. Check Funnel Stats
        stats_res = self.client.get("/stats")
        self.assertEqual(stats_res.status_code, 200)
        stats = stats_res.json()["data"]
        self.assertEqual(stats["total_applications"], 1)
        self.assertEqual(stats["interview_count"], 1)
        self.assertEqual(stats["applied_count"], 0)
        self.assertEqual(stats["response_rate_percent"], 100.0)

    def test_user_profile_sync(self):
        """Test storing and retrieving user autofill master profile."""
        profile_data = {
            "first_name": "Gabriel",
            "last_name": "Hayes",
            "email": "gabe@example.com",
            "phone": "555-123-4567",
            "city": "Austin",
            "state": "TX",
            "country": "United States",
            "linkedin": "https://linkedin.com/in/gabehayes",
            "github": "https://github.com/Ta11-Man",
            "work_authorized_us": "Yes",
            "require_sponsorship": "No",
            "school": "University of Texas",
            "degree": "B.S. Computer Science",
            "desired_salary": "$160,000"
        }

        # Save profile
        save_res = self.client.post("/profile", json=profile_data)
        self.assertEqual(save_res.status_code, 200)

        # Fetch profile
        get_res = self.client.get("/profile")
        self.assertEqual(get_res.status_code, 200)
        saved_profile = get_res.json()["data"]
        self.assertEqual(saved_profile["first_name"], "Gabriel")
        self.assertEqual(saved_profile["github"], "https://github.com/Ta11-Man")
        self.assertEqual(saved_profile["desired_salary"], "$160,000")

    def test_application_updates_and_deletion(self):
        """Test partial updates and deletion of applications."""
        payload = {
            "company_name": "TestCorp",
            "job_title": "Junior Dev",
            "date_applied": "2026-08-10"
        }
        create_res = self.client.post("/apply", json=payload)
        app_id = create_res.json()["id"]

        # Update notes & priority
        update_payload = {"notes": "Updated note", "priority": 4, "salary_range": "$120k"}
        put_res = self.client.put(f"/applications/{app_id}", json=update_payload)
        self.assertEqual(put_res.status_code, 200)

        # Verify update
        app = self.client.get(f"/applications/{app_id}").json()["data"]
        self.assertEqual(app["notes"], "Updated note")
        self.assertEqual(app["priority"], 4)
        self.assertEqual(app["salary_range"], "$120k")

        # Delete
        del_res = self.client.delete(f"/applications/{app_id}")
        self.assertEqual(del_res.status_code, 200)

        # Verify not found
        get_after = self.client.get(f"/applications/{app_id}")
        self.assertEqual(get_after.status_code, 404)

if __name__ == "__main__":
    unittest.main()
