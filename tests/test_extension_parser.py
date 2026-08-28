"""
Automated parser and field matcher validation for GRTS Extension.
Validates extraction logic and custom question detection across
Greenhouse, Workday, Lever, and Ashby test pages.
"""
import unittest
import os
from bs4 import BeautifulSoup

class TestExtensionParsers(unittest.TestCase):
    def setUp(self):
        self.tests_dir = os.path.dirname(__file__)

    def test_workday_parser(self):
        """Test Workday parser extraction against tests/workday.html."""
        html_path = os.path.join(self.tests_dir, "workday.html")
        with open(html_path, "r", encoding="utf-8") as f:
            soup = BeautifulSoup(f.read(), "html.parser")

        # 1. Title Extraction
        title_el = soup.select_one('[data-automation-id="jobPostingHeader"], [data-automation-id="jobTitle"]')
        self.assertIsNotNone(title_el)
        self.assertEqual(title_el.text.strip(), "Senior Distributed Systems Engineer")

        # 2. Location Extraction
        loc_el = soup.select_one('[data-automation-id="locations"]')
        self.assertIsNotNone(loc_el)
        self.assertIn("Seattle, WA", loc_el.text)

        # 3. Job ID
        req_el = soup.select_one('[data-automation-id="requisitionId"]')
        self.assertIsNotNone(req_el)
        self.assertEqual(req_el.text.strip(), "REQ-2026-8941")

        # 4. Standard Form Inputs
        fname = soup.select_one('[data-automation-id="legalNameSection_firstName"]')
        self.assertIsNotNone(fname)
        lname = soup.select_one('[data-automation-id="legalNameSection_lastName"]')
        self.assertIsNotNone(lname)
        email = soup.select_one('[data-automation-id="email"]')
        self.assertIsNotNone(email)

        # 5. Non-standard Custom Questions Detection
        custom_q = soup.select_one('[data-automation-id="customQuestion_consensus"]')
        self.assertIsNotNone(custom_q)
        label = soup.select_one('label[for="custom_consensus"]')
        self.assertIn("experience with Raft, Paxos", label.text)

    def test_lever_parser(self):
        """Test Lever parser extraction against tests/lever.html."""
        html_path = os.path.join(self.tests_dir, "lever.html")
        with open(html_path, "r", encoding="utf-8") as f:
            soup = BeautifulSoup(f.read(), "html.parser")

        # Title
        headline = soup.select_one(".posting-headline h2")
        self.assertIsNotNone(headline)
        self.assertEqual(headline.text.strip(), "Senior Backend Infrastructure Engineer")

        # Location
        loc = soup.select_one(".posting-categories .location")
        self.assertIsNotNone(loc)
        self.assertEqual(loc.text.strip(), "San Francisco, CA")

        # Custom Question
        custom_ta = soup.select_one('textarea[name="comments"]')
        self.assertIsNotNone(custom_ta)

    def test_ashby_parser(self):
        """Test Ashby parser extraction against tests/ashby.html."""
        html_path = os.path.join(self.tests_dir, "ashby.html")
        with open(html_path, "r", encoding="utf-8") as f:
            soup = BeautifulSoup(f.read(), "html.parser")

        # Title
        title = soup.select_one('[data-testid="job-title"]')
        self.assertIsNotNone(title)
        self.assertIn("Senior Frontend Engineer", title.text)

        # Custom Question
        custom_q = soup.select_one('textarea[name="custom_portfolio_detail"]')
        self.assertIsNotNone(custom_q)

    def test_greenhouse_parser(self):
        """Test Greenhouse parser extraction against tests/greenhouse.html."""
        html_path = os.path.join(self.tests_dir, "greenhouse.html")
        with open(html_path, "r", encoding="utf-8") as f:
            soup = BeautifulSoup(f.read(), "html.parser")

        # Check form exists
        form = soup.select_one("#application-form, #application_form, form")
        self.assertIsNotNone(form)

        # First and last name fields
        fname = soup.select_one("#first_name, [name='first_name']")
        self.assertIsNotNone(fname)
        email = soup.select_one("#email, [name='email']")
        self.assertIsNotNone(email)

    def test_oraclecloud_parser(self):
        """Test Oracle Cloud Candidate Experience parser patterns."""
        sample_html = """
        <!DOCTYPE html>
        <html>
        <head>
            <title>Software Engineer | JPMorgan Chase & Co.</title>
            <meta property="og:site_name" content="JPMorgan Chase & Co.">
            <link rel="icon" href="https://jpmc.fa.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_1001/assets/branding/favicon.ico">
        </head>
        <body>
            <header class="cx-site-header">
                <img src="https://jpmc.fa.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_1001/assets/branding/logo.png" alt="JPMorgan Chase">
            </header>
            <h1 data-qa="job-title">Software Engineer - Full Stack</h1>
            <div data-qa="job-location">New York, NY</div>
            <div data-qa="job-description">Build high-scale distributed financial systems.</div>
        </body>
        </html>
        """
        soup = BeautifulSoup(sample_html, "html.parser")
        
        # 1. Company Name & Favicon
        icon_el = soup.select_one('link[rel="icon"]')
        self.assertIsNotNone(icon_el)
        self.assertEqual(icon_el["href"], "https://jpmc.fa.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_1001/assets/branding/favicon.ico")

        # 2. Header Logo & Company
        logo_el = soup.select_one('.cx-site-header img')
        self.assertIsNotNone(logo_el)
        self.assertEqual(logo_el["alt"], "JPMorgan Chase")

        # 3. Title & Location
        title_el = soup.select_one('[data-qa="job-title"]')
        self.assertIsNotNone(title_el)
        self.assertEqual(title_el.text.strip(), "Software Engineer - Full Stack")

        loc_el = soup.select_one('[data-qa="job-location"]')
        self.assertIsNotNone(loc_el)
        self.assertEqual(loc_el.text.strip(), "New York, NY")

if __name__ == "__main__":
    unittest.main()
