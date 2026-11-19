/**
 * Report Generation Service
 * Produces downloadable reports:
 * 1. ATS & AI Comprehensive Analysis Report
 * 2. Skill Match & Missing Skills Report (CSV & JSON)
 * 3. Priority ATS Correction Action Plan
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const PDFDocument = require('pdfkit');

class ReportService {
  constructor() {
    this.reportsDir = (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME)
      ? path.join('/tmp', 'reports')
      : path.join(__dirname, '../uploads/reports');
    try {
      if (!fs.existsSync(this.reportsDir)) {
        fs.mkdirSync(this.reportsDir, { recursive: true, mode: 0o700 });
      }
      try { fs.chmodSync(this.reportsDir, 0o700); } catch { /* Windows ACLs govern this directory. */ }
    } catch {
      // Non-fatal on read-only serverless environments
    }
  }

  /**
   * Generates a downloadable CSV of matched vs missing skills
   */
  generateSkillMatchCSV(candidateName, targetRole, matchData) {
    const filename = `skill_report_${crypto.randomUUID()}.csv`;
    const filePath = path.join(this.reportsDir, filename);

    const headers = ["Status", "Skill Name", "Category", "Target Role"];
    const rows = [];

    (matchData.matchingSkills || matchData.found || []).forEach(s => {
      rows.push(["MATCHED", `"${s}"`, "Technical Skill", `"${targetRole}"`]);
    });

    (matchData.missingSkills || matchData.missing || []).forEach(s => {
      rows.push(["MISSING / GAP", `"${s}"`, "Target Prerequisite", `"${targetRole}"`]);
    });

    const csvContent = [
      `# ASCEND Skill Match Report for ${candidateName} - ${targetRole}`,
      `# Generated: ${new Date().toISOString()}`,
      `# Overall Match Score: ${matchData.matchScore || matchData.score || '--'}%`,
      `# Note: Guidance based on keyword relevance, not a hiring prediction.`,
      "",
      headers.join(","),
      ...rows.map(r => r.join(","))
    ].join("\n");

    fs.writeFileSync(filePath, csvContent, { encoding: 'utf8', flag: 'wx', mode: 0o600 });

    return {
      filename,
      filePath,
      url: `/api/reports/download/${filename}`
    };
  }

  /**
   * Generates a comprehensive PDF Report (Analysis, Missing Skills, and Action Plan)
   */
  async generateAnalysisPDF(candidate, evaluation, aiAnalysis, targetRole) {
    return new Promise((resolve, reject) => {
      try {
        const filename = `analysis_report_${crypto.randomUUID()}.pdf`;
        const filePath = path.join(this.reportsDir, filename);
        const writeStream = fs.createWriteStream(filePath, { flags: 'wx', mode: 0o600 });

        const doc = new PDFDocument({ margin: 40, size: 'A4' });
        doc.pipe(writeStream);

        // Header
        doc.fillColor('#4338CA').fontSize(22).font('Helvetica-Bold').text('ASCEND Career Intelligence');
        doc.fillColor('#1F2937').fontSize(14).font('Helvetica-Bold').text(`Resume & Skill Evaluation Report: ${targetRole}`);
        doc.fillColor('#6B7280').fontSize(9).font('Helvetica').text(`Candidate: ${candidate.name || 'Candidate'} | Date: ${new Date().toLocaleDateString()}`);
        doc.moveDown(0.5);

        doc.strokeColor('#E5E7EB').lineWidth(1).moveTo(40, doc.y).lineTo(555, doc.y).stroke();
        doc.moveDown(0.8);

        // Score Card
        doc.fillColor('#1E1B4B').fontSize(14).font('Helvetica-Bold').text(`ATS Readiness Score: ${evaluation.score || 0} / 100`);
        doc.fillColor('#4B5563').fontSize(9.5).font('Helvetica').text(evaluation.summary || 'Summary unavailable');
        doc.moveDown(0.8);

        // Ethical Disclaimer
        doc.fillColor('#9CA3AF').fontSize(8).font('Helvetica-Oblique').text(
          'Guidance Notice: This evaluation is algorithmic guidance based on automated pattern analysis. It is designed to assist preparation, not to serve as an employer hiring prediction or guarantee.'
        );
        doc.moveDown(1);

        // Skill Match Section
        doc.fillColor('#4338CA').fontSize(12).font('Helvetica-Bold').text('1. Skill Match Breakdown');
        doc.moveDown(0.3);

        const found = evaluation.matchStats?.found || [];
        const missing = evaluation.matchStats?.missing || [];

        doc.fontSize(9.5).font('Helvetica').fillColor('#059669').text(`✔ Matched Skills (${found.length}): ${found.join(', ') || 'None identified'}`);
        doc.fontSize(9.5).font('Helvetica').fillColor('#DC2626').text(`✖ Missing Target Skills (${missing.length}): ${missing.join(', ') || 'None'}`);
        doc.moveDown(0.8);

        // AI Strengths & Weaknesses
        if (aiAnalysis) {
          doc.fillColor('#4338CA').fontSize(12).font('Helvetica-Bold').text('2. Strengths & Development Areas');
          doc.moveDown(0.3);

          (aiAnalysis.strengths || []).slice(0, 3).forEach(s => {
            doc.fontSize(9.5).font('Helvetica-Bold').fillColor('#1F2937').text(`• Strength: ${s.item}`);
            doc.fontSize(8.5).font('Helvetica').fillColor('#4B5563').text(`  Why: ${s.why}`);
            doc.moveDown(0.2);
          });

          (aiAnalysis.weaknesses || []).slice(0, 3).forEach(w => {
            doc.fontSize(9.5).font('Helvetica-Bold').fillColor('#B91C1C').text(`• Gap: ${w.item}`);
            doc.fontSize(8.5).font('Helvetica').fillColor('#4B5563').text(`  Why: ${w.why}`);
            doc.moveDown(0.2);
          });
          doc.moveDown(0.5);
        }

        // Two-Column ATS Feedback
        if (evaluation.atsFeedbackRows && evaluation.atsFeedbackRows.length > 0) {
          doc.fillColor('#4338CA').fontSize(12).font('Helvetica-Bold').text('3. ATS Action Plan');
          doc.moveDown(0.3);

          evaluation.atsFeedbackRows.slice(0, 4).forEach(row => {
            doc.fontSize(9).font('Helvetica-Bold').fillColor('#374151').text(`[${row.section}] +${row.potentialScoreGain} Pts Potential`);
            doc.fontSize(8.5).font('Helvetica').fillColor('#DC2626').text(`Issue: ${row.error.split('\n')[0]}`);
            doc.fontSize(8.5).font('Helvetica').fillColor('#059669').text(`Fix: ${row.correction.split('\n')[0]}`);
            doc.moveDown(0.3);
          });
        }

        doc.end();

        writeStream.on('finish', () => {
          resolve({
            filename,
            filePath,
            url: `/api/reports/download/${filename}`
          });
        });

        writeStream.on('error', reject);
      } catch (e) {
        reject(e);
      }
    });
  }
}

module.exports = new ReportService();
