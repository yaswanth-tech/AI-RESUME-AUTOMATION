/**
 * Resume Generation Service (PDF & DOCX Export with 3 Templates)
 * 
 * Templates:
 * 1. "Modern Clean" - Crisp headers, indigo accents, balanced spacing
 * 2. "Executive Classic" - Traditional serif/slate, centered header, formal structure
 * 3. "Tech Minimal" - Compact developer style with bracketed headers & high skill density
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const PDFDocument = require('pdfkit');
const { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, BorderStyle, Table, TableRow, TableCell, WidthType } = require('docx');

class ResumeExportService {
  constructor() {
    this.exportsDir = (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME)
      ? path.join('/tmp', 'generated')
      : path.join(__dirname, '../uploads/generated');
    try {
      if (!fs.existsSync(this.exportsDir)) {
        fs.mkdirSync(this.exportsDir, { recursive: true, mode: 0o700 });
      }
      try { fs.chmodSync(this.exportsDir, 0o700); } catch { /* Windows ACLs govern this directory. */ }
    } catch {
      // Non-fatal on read-only serverless environments
    }
  }

  /**
   * Generates PDF with one of 3 templates
   */
  async generatePDF(candidate, templateName = 'Modern Clean') {
    return new Promise((resolve, reject) => {
      try {
        const filename = `resume_${crypto.randomUUID()}.pdf`;
        const filePath = path.join(this.exportsDir, filename);
        const writeStream = fs.createWriteStream(filePath, { flags: 'wx', mode: 0o600 });

        const doc = new PDFDocument({
          margin: 40,
          size: 'A4',
          bufferPages: true
        });

        doc.pipe(writeStream);

        // Normalize data
        const name = candidate.name || 'Candidate Name';
        const contactLine = [candidate.email, candidate.phone].filter(Boolean).join(' | ');
        const summary = candidate.summary || '';
        const skills = candidate.skills || (Array.isArray(candidate.skillsList) ? candidate.skillsList.join(', ') : '');
        const tools = candidate.tools || (Array.isArray(candidate.toolsList) ? candidate.toolsList.join(', ') : '');
        const experience = candidate.experience || '';
        const projects = candidate.projects || '';
        const education = candidate.education || '';
        const certifications = candidate.certifications || '';
        const achievements = candidate.achievements || '';

        // Style configurations based on template
        if (templateName === 'Tech Minimal') {
          // --- TECH MINIMAL TEMPLATE ---
          doc.fillColor('#111827').fontSize(22).font('Courier-Bold').text(name);
          doc.fontSize(9).font('Courier').fillColor('#4B5563').text(contactLine);
          doc.moveDown(0.5);
          doc.strokeColor('#D1D5DB').lineWidth(1).moveTo(40, doc.y).lineTo(555, doc.y).stroke();
          doc.moveDown(0.8);

          const renderTechSection = (title, content) => {
            if (!content || content === 'Missing') return;
            doc.fontSize(11).font('Courier-Bold').fillColor('#0284C7').text(`// ${title.toUpperCase()}`);
            doc.moveDown(0.2);
            doc.fontSize(9.5).font('Courier').fillColor('#1F2937').text(content, { align: 'left', lineGap: 2 });
            doc.moveDown(0.8);
          };

          if (summary) renderTechSection('About', summary);
          if (skills) renderTechSection('Skills & Tech', skills);
          if (tools) renderTechSection('Developer Tools', tools);
          if (experience) renderTechSection('Work History', experience);
          if (projects) renderTechSection('Projects Built', projects);
          if (education) renderTechSection('Education', education);
          if (certifications) renderTechSection('Certifications', certifications);
          if (achievements) renderTechSection('Achievements', achievements);

        } else if (templateName === 'Executive Classic') {
          // --- EXECUTIVE CLASSIC TEMPLATE ---
          doc.fillColor('#1E293B').fontSize(22).font('Times-Bold').text(name, { align: 'center' });
          doc.fontSize(10).font('Times-Roman').fillColor('#475569').text(contactLine, { align: 'center' });
          doc.moveDown(0.5);
          doc.strokeColor('#334155').lineWidth(1.5).moveTo(60, doc.y).lineTo(535, doc.y).stroke();
          doc.moveDown(0.8);

          const renderClassicSection = (title, content) => {
            if (!content || content === 'Missing') return;
            doc.fontSize(12).font('Times-Bold').fillColor('#1E293B').text(title.toUpperCase(), { align: 'left' });
            doc.strokeColor('#CBD5E1').lineWidth(0.5).moveTo(40, doc.y).lineTo(555, doc.y).stroke();
            doc.moveDown(0.3);
            doc.fontSize(10).font('Times-Roman').fillColor('#334155').text(content, { lineGap: 3 });
            doc.moveDown(0.8);
          };

          if (summary) renderClassicSection('Executive Summary', summary);
          if (skills) renderClassicSection('Core Competencies', skills);
          if (tools) renderClassicSection('Technical Tools', tools);
          if (experience) renderClassicSection('Professional Experience', experience);
          if (projects) renderClassicSection('Key Projects', projects);
          if (education) renderClassicSection('Academic Credentials', education);
          if (certifications) renderClassicSection('Professional Certifications', certifications);
          if (achievements) renderClassicSection('Key Accomplishments', achievements);

        } else {
          // --- MODERN CLEAN TEMPLATE (Default) ---
          doc.fillColor('#4F46E5').fontSize(24).font('Helvetica-Bold').text(name);
          doc.fontSize(9.5).font('Helvetica').fillColor('#6B7280').text(contactLine);
          doc.moveDown(0.4);
          doc.strokeColor('#6366F1').lineWidth(2).moveTo(40, doc.y).lineTo(555, doc.y).stroke();
          doc.moveDown(0.8);

          const renderModernSection = (title, content) => {
            if (!content || content === 'Missing') return;
            doc.fontSize(11.5).font('Helvetica-Bold').fillColor('#4338CA').text(title);
            doc.moveDown(0.2);
            doc.fontSize(9.5).font('Helvetica').fillColor('#374151').text(content, { lineGap: 2.5 });
            doc.moveDown(0.7);
          };

          if (summary) renderModernSection('Professional Summary', summary);
          if (skills) renderModernSection('Technical Skills', skills);
          if (tools) renderModernSection('Tools & Frameworks', tools);
          if (experience) renderModernSection('Experience', experience);
          if (projects) renderModernSection('Selected Projects', projects);
          if (education) renderModernSection('Education', education);
          if (certifications) renderModernSection('Certifications & Honors', certifications);
          if (achievements) renderModernSection('Achievements', achievements);
        }

        doc.end();

        writeStream.on('finish', () => {
          resolve({
            filename,
            filePath,
            url: `/api/resume/download/${filename}`
          });
        });

        writeStream.on('error', reject);
      } catch (err) {
        reject(err);
      }
    });
  }

  /**
   * Generates DOCX with one of 3 templates
   */
  async generateDOCX(candidate, templateName = 'Modern Clean') {
    const filename = `resume_${crypto.randomUUID()}.docx`;
    const filePath = path.join(this.exportsDir, filename);

    const name = candidate.name || 'Candidate Name';
    const contactLine = [candidate.email, candidate.phone].filter(Boolean).join(' | ');
    const summary = candidate.summary || '';
    const skills = candidate.skills || (Array.isArray(candidate.skillsList) ? candidate.skillsList.join(', ') : '');
    const tools = candidate.tools || (Array.isArray(candidate.toolsList) ? candidate.toolsList.join(', ') : '');
    const experience = candidate.experience || '';
    const projects = candidate.projects || '';
    const education = candidate.education || '';
    const certifications = candidate.certifications || '';
    const achievements = candidate.achievements || '';

    let primaryColor = '4F46E5';
    let fontFamily = 'Calibri';
    let isCenteredHeader = false;

    if (templateName === 'Executive Classic') {
      primaryColor = '1E293B';
      fontFamily = 'Georgia';
      isCenteredHeader = true;
    } else if (templateName === 'Tech Minimal') {
      primaryColor = '0284C7';
      fontFamily = 'Consolas';
      isCenteredHeader = false;
    }

    const docChildren = [
      new Paragraph({
        alignment: isCenteredHeader ? AlignmentType.CENTER : AlignmentType.LEFT,
        children: [
          new TextRun({
            text: name,
            bold: true,
            size: 36,
            font: fontFamily,
            color: primaryColor
          })
        ]
      }),
      new Paragraph({
        alignment: isCenteredHeader ? AlignmentType.CENTER : AlignmentType.LEFT,
        children: [
          new TextRun({
            text: contactLine,
            size: 18,
            font: fontFamily,
            color: '666666'
          })
        ]
      }),
      new Paragraph({ text: '' })
    ];

    const addSection = (title, content) => {
      if (!content || content === 'Missing') return;

      docChildren.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 200, after: 80 },
          children: [
            new TextRun({
              text: title,
              bold: true,
              size: 22,
              font: fontFamily,
              color: primaryColor
            })
          ]
        })
      );

      // Split lines to create clean paragraphs
      content.split(/\r?\n/).forEach(line => {
        if (line.trim().length > 0) {
          docChildren.push(
            new Paragraph({
              spacing: { after: 60 },
              children: [
                new TextRun({
                  text: line.trim(),
                  size: 19,
                  font: fontFamily,
                  color: '333333'
                })
              ]
            })
          );
        }
      });
    };

    addSection('Professional Summary', summary);
    addSection('Technical Skills', skills);
    addSection('Tools & Technologies', tools);
    addSection('Professional Experience', experience);
    addSection('Projects', projects);
    addSection('Education', education);
    addSection('Certifications', certifications);
    addSection('Achievements', achievements);

    const doc = new Document({
      sections: [{
        properties: {
          page: {
            margin: { top: 720, bottom: 720, left: 720, right: 720 }
          }
        },
        children: docChildren
      }]
    });

    const buffer = await Packer.toBuffer(doc);
    fs.writeFileSync(filePath, buffer, { flag: 'wx', mode: 0o600 });

    return {
      filename,
      filePath,
      url: `/api/resume/download/${filename}`
    };
  }
}

module.exports = new ResumeExportService();
