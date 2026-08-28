"""
Unit tests for GRTS Local IMAP Email Scanner & Intelligent Matching Engine.
Validates email classification, deadline extraction, company matching, and database updates.
"""
import unittest
import os
import sys
from datetime import datetime, timedelta

# Ensure backend directory is in python path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))

import database
import email_scanner

class TestEmailScanner(unittest.TestCase):
    def setUp(self):
        database.init_db()

    def test_rejection_classification(self):
        """Test detection of rejection emails from various ATS and direct formats."""
        # 1. Greenhouse style rejection
        sender = "Stripe Recruiting <no-reply@greenhouse.io>"
        subject = "Your application to Stripe"
        body = """
        Hi Gabe,
        Thank you for your interest in the Software Engineer role at Stripe.
        After careful review of your background and qualifications, we have decided to move forward
        with other candidates whose experience more closely aligns with our current needs.
        We wish you the best in your job search.
        """
        res = email_scanner.classify_email(sender, subject, body, "2026-08-24")
        self.assertIsNotNone(res)
        self.assertEqual(res["category"], "rejection")
        self.assertEqual(res["event_type"], "Rejected")

        # 2. Workday style rejection
        sender = "Citadel Careers <citadel@myworkdayjobs.com>"
        subject = "Citadel Application Status"
        body = "Unfortunately, we are not moving forward with your application for the Quantitative Engineer role."
        res2 = email_scanner.classify_email(sender, subject, body, "2026-08-24")
        self.assertIsNotNone(res2)
        self.assertEqual(res2["category"], "rejection")

        # 3. Mere confirmation (Should NOT be classified as rejection)
        confirm_body = "Thank you for applying to Palantir. We have received your application and our team is currently reviewing it."
        res3 = email_scanner.classify_email("no-reply@palantir.com", "Application Confirmation", confirm_body, "2026-08-24")
        self.assertIsNone(res3)

    def test_oa_classification_and_deadline(self):
        """Test detection of Online Assessment invitations and deadline extraction."""
        # 1. HackerRank with 'within 7 days'
        sender = "Roblox Recruiting <support@hackerrank.com>"
        subject = "Roblox Software Engineer Assessment Invitation"
        body = """
        Hi Gabe,
        You have been invited to complete the Roblox Technical Assessment on HackerRank.
        Please complete the assessment within 7 days of receiving this email.
        Click here to start: https://hackerrank.com/test/xyz
        """
        res = email_scanner.classify_email(sender, subject, body, "2026-08-24")
        self.assertIsNotNone(res)
        self.assertEqual(res["category"], "oa")
        self.assertEqual(res["platform"], "HackerRank")
        
        # Expected deadline is 7 days from now
        expected_deadline = (datetime.now() + timedelta(days=7)).strftime("%Y-%m-%d")
        self.assertEqual(res["oa_expiration_date"], expected_deadline)

        # 2. CodeSignal with explicit date 'by September 5, 2026'
        body_cs = "You have received a CodeSignal assessment for Databricks. Please complete your assessment by September 5, 2026."
        res_cs = email_scanner.classify_email("notifications@codesignal.com", "CodeSignal Invitation from Databricks", body_cs, "2026-08-24")
        self.assertIsNotNone(res_cs)
        self.assertEqual(res_cs["category"], "oa")
        self.assertEqual(res_cs["platform"], "CodeSignal")
        self.assertEqual(res_cs["oa_expiration_date"], "2026-09-05")

    def test_interview_classification(self):
        """Test detection of recruiter screens and interview scheduling invitations."""
        sender = "Jane Recruiter <jane.recruiter@company.com>"
        subject = "Next Steps: Software Engineer Interview with Company"
        body = "We were impressed with your profile and would love to schedule a recruiter screen. Please select a time using my Calendly link: https://calendly.com/jane-screen"
        res = email_scanner.classify_email(sender, subject, body, "2026-08-24")
        self.assertIsNotNone(res)
        self.assertEqual(res["category"], "interview")
        self.assertEqual(res["event_type"], "Recruiter Screen")

    def test_company_matching(self):
        """Test matching incoming emails to active job application records."""
        active_apps = [
            {"id": 101, "company_name": "Stripe", "company_website": "https://stripe.com", "job_title": "Software Engineer"},
            {"id": 102, "company_name": "Palantir Technologies", "company_website": "https://palantir.com", "job_title": "Forward Deployed Engineer"},
            {"id": 103, "company_name": "JPMorgan Chase", "company_website": "https://jpmorganchase.com", "job_title": "SWE Associate"}
        ]

        # 1. Match from ATS display name
        sender_1 = "Stripe University Recruiting <no-reply@greenhouse-mail.io>"
        match_1 = email_scanner.match_email_to_application(sender_1, "Your application update", "Hello Gabe...", active_apps)
        self.assertIsNotNone(match_1)
        self.assertEqual(match_1["id"], 101)

        # 2. Match from Subject Line
        sender_2 = "no-reply@myworkday.com"
        match_2 = email_scanner.match_email_to_application(sender_2, "Update from JPMorgan Chase", "Dear Applicant...", active_apps)
        self.assertIsNotNone(match_2)
        self.assertEqual(match_2["id"], 103)

        # 3. Match from Direct Domain
        sender_3 = "careers@palantir.com"
        match_3 = email_scanner.match_email_to_application(sender_3, "Interview Invitation", "Hello Gabe...", active_apps)
        self.assertIsNotNone(match_3)
        self.assertEqual(match_3["id"], 102)

if __name__ == "__main__":
    unittest.main()
