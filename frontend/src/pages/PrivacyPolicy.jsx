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
            <li><strong>Student identification</strong> — each student number is additionally stored as a <strong>one-way SHA-256 hash</strong> (<code>hashed_identifier</code>). All performance records (scores, competency mastery, risk predictions) reference only this hash, never the raw student number, decoupling identity from academic-performance data.</li>
            <li><strong>Assessment data</strong> — question text, scores, and grading period associated with enrolled courses.</li>
            <li><strong>Syllabus content</strong> — uploaded PDF/DOCX files used to extract course competencies.</li>
            <li><strong>Usage logs</strong> — action audit logs (login events, file uploads) containing user ID, action type, and timestamp; used for security and accountability only.</li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-semibold text-gray-700">3. How We Use Your Data</h2>
          <ul className="text-sm list-disc list-inside space-y-1 leading-relaxed">
            <li>Classify academic risk with fixed, rule-based thresholds and match remedial resources to learning gaps.</li>
            <li>Provide instructors with anonymized, aggregate course analytics.</li>
            <li>Maintain system security and audit trails as required by university policy.</li>
          </ul>
          <p className="text-sm leading-relaxed">
            Student performance data surfaced to instructors is presented in <strong>anonymized form</strong> (truncated hash identifiers). Individual student records are accessible only to the student themselves.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-semibold text-gray-700">4. Data Sharing</h2>
          <p className="text-sm leading-relaxed">
            AILAS does not sell or share personal data with third parties. Assessment text and syllabus content are processed by the <strong>OpenAI API</strong> (GPT-4o-mini) solely to generate competency mappings and risk predictions. No personally identifiable information is included in prompts sent to the API.
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
