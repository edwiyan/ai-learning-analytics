import Layout from "../components/Layout";

export default function PrivacyPolicy() {
  return (
    <Layout>
      <div className="max-w-3xl mx-auto space-y-6 text-gray-700">
        <h1 className="text-2xl font-bold text-gray-800">Privacy Policy</h1>
        <p className="text-xs text-gray-400">Effective date: June 1, 2025 &mdash; Dalubhasaang Politekniko ng Lungsod ng Baliwag (BTECH)</p>

        <section className="space-y-2">
          <h2 className="text-base font-semibold text-gray-700">1. Overview</h2>
          <p className="text-sm leading-relaxed">
            The AI-Assisted Learning Analytics System (AILAS) is operated by Dalubhasaang Politekniko ng Lungsod ng Baliwag (BTECH) in compliance with the <strong>Data Privacy Act of 2012 (Republic Act No. 10173)</strong> and its Implementing Rules and Regulations. This policy describes what data we collect, why we collect it, and how it is protected.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-semibold text-gray-700">2. Data We Collect</h2>
          <ul className="text-sm list-disc list-inside space-y-1 leading-relaxed">
            <li><strong>Account information</strong> — full name, institutional email address, role (student/instructor/admin).</li>
            <li><strong>Student identification</strong> — each student number is stored as a <strong>salted SHA-256 hash</strong> (<code>hashed_identifier</code>). Performance records (scores, competency mastery, risk classifications) reference only this hash, never the raw student number. Hashing is pseudonymization, not anonymization: the data is still personal data under RA 10173 and is protected by access controls.</li>
            <li><strong>Assessment data</strong> — question text, scores, and grading period associated with enrolled courses.</li>
            <li><strong>Syllabus content</strong> — uploaded PDF/DOCX files used to extract course competencies.</li>
            <li><strong>Usage logs</strong> — action audit logs (login events, file uploads) containing user ID, action type, and timestamp; used for security and accountability only.</li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-semibold text-gray-700">3. How We Use Your Data</h2>
          <ul className="text-sm list-disc list-inside space-y-1 leading-relaxed">
            <li>Classify academic risk with fixed, rule-based thresholds and match remedial resources to learning gaps.</li>
            <li>Give instructors and academic administrators course and program analytics for the students they handle.</li>
            <li>Maintain system security and audit trails as required by university policy.</li>
          </ul>
          <p className="text-sm leading-relaxed">
            A student's own results are visible to the student, to the instructors of the student's courses, and, for reporting, to the Program Director, Dean and VP for Academic Affairs of the student's college. Access is limited by role and every report export is logged.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-semibold text-gray-700">4. Data Sharing</h2>
          <p className="text-sm leading-relaxed">
            AILAS does not sell or share personal data. It uses the <strong>OpenAI API</strong> (GPT-4o-mini) only for text tasks. All performance calculations (mastery, grade decline, risk classification and resource matching) run on BTECH's own server.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border border-gray-200 rounded-lg">
              <thead className="bg-gray-50 text-left text-xs text-gray-500">
                <tr><th className="px-3 py-2 font-medium">Sent to the AI provider</th><th className="px-3 py-2 font-medium">Never sent</th></tr>
              </thead>
              <tbody className="align-top">
                <tr className="border-t border-gray-100">
                  <td className="px-3 py-2">Syllabus text with email addresses and phone numbers removed; assessment question text; competency and learning-outcome text; resource titles; names of weak topics (for an optional encouragement message, with no student identity)</td>
                  <td className="px-3 py-2">Student numbers, names and email addresses; scores, grades and mastery; risk classifications; interventions and attendance</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="text-sm leading-relaxed">
            Every request is checked before it is sent and is blocked if it contains a student number or a student's name. Requests ask the provider not to store them. Under the provider's API terms, API data is not used to train its models by default.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-semibold text-gray-700">5. Data Retention</h2>
          <p className="text-sm leading-relaxed">
            Academic records are retained for the duration of the academic year and archived in accordance with BTECH records management policy. Users may request deletion of their account data by contacting the system administrator.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-semibold text-gray-700">6. Security</h2>
          <p className="text-sm leading-relaxed">
            Passwords are stored using bcrypt hashing. Student IDs are stored as SHA-256 hashes. All API endpoints require JWT-based authentication. Transport security (HTTPS) is enforced in production. Security headers (X-Content-Type-Options, X-Frame-Options, Content-Security-Policy) are applied to all responses.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-semibold text-gray-700">7. Your Rights</h2>
          <p className="text-sm leading-relaxed">
            Under RA 10173, you have the right to be informed, to access, to object, to erasure, and to rectification of your personal data. To exercise these rights, contact the BTECH Data Protection Officer.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-semibold text-gray-700">8. Contact</h2>
          <p className="text-sm leading-relaxed">
            For privacy-related concerns, contact the AILAS development team or the BTECH Data Protection Officer at <span className="font-mono text-xs">dpo@btech.edu.ph</span>.
          </p>
        </section>
      </div>
    </Layout>
  );
}
