/**
 * Enhanced Rule-based Resume Parser (Non-AI base)
 * Extracts all 11 required candidate record fields:
 * - name, email, phone, summary, education, experience,
 * - skills, certifications, projects, tools, achievements
 */
const fs = require('fs');
const path = require('path');

const KEYWORDS_PATH = path.join(__dirname, '../datasets/ats_keywords.json');

function parseResume(text) {
  if (!text || typeof text !== 'string') {
    text = '';
  }

  const sections = {
    Name: "Missing",
    Email: "Missing",
    Phone: "Missing",
    Summary: "Missing",
    Skills: "Missing",
    Tools: "Missing",
    Education: "Missing",
    Experience: "Missing",
    Projects: "Missing",
    Certifications: "Missing",
    Achievements: "Missing"
  };

  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
  let keywords = {};
  try {
    keywords = JSON.parse(fs.readFileSync(KEYWORDS_PATH, 'utf8')).sectionKeywords;
  } catch (e) {
    keywords = {
      Summary: ["summary", "profile", "objective", "about me"],
      Skills: ["skills", "technical skills", "competencies", "technologies"],
      Tools: ["tools", "developer tools", "software tools"],
      Education: ["education", "academic", "university", "college", "degree"],
      Experience: ["experience", "work history", "employment", "professional background"],
      Projects: ["projects", "personal projects", "portfolio"],
      Certifications: ["certifications", "licenses", "courses", "certificates"],
      Achievements: ["achievements", "accomplishments", "honors", "awards"]
    };
  }

  // 1. Basic Info Extraction (Top of the resume)
  const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/;
  const phoneRegex = /(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/;
  const nonNameKeywords = ['resume', 'curriculum vitae', 'cv', 'profile', 'contact', 'email', 'phone', 'address', 'portfolio', 'github', 'linkedin', 'http'];

  for (let i = 0; i < Math.min(lines.length, 25); i++) {
    const line = lines[i];

    if (sections.Email === "Missing" && emailRegex.test(line)) {
      const match = line.match(emailRegex);
      if (match) sections.Email = match[0];
    }

    if (sections.Phone === "Missing" && phoneRegex.test(line)) {
      const match = line.match(phoneRegex);
      if (match) sections.Phone = match[0];
    }

    // Heuristic for Name: Early in document, reasonable length, not email/url/heading keyword
    if (sections.Name === "Missing") {
      const lower = line.toLowerCase();
      const hasEmailOrUrl = line.includes('@') || lower.includes('http') || lower.includes('.com');
      const isKnownHeader = nonNameKeywords.some(k => lower === k || lower.startsWith(k + ':'));
      if (line.length >= 3 && line.length <= 40 && !hasEmailOrUrl && !isKnownHeader && !phoneRegex.test(line)) {
        // Strip titles like "John Doe - Software Engineer"
        const cleanName = line.split(/[|•–—\-]/)[0].trim();
        if (cleanName.length >= 3) {
          sections.Name = cleanName;
        }
      }
    }
  }

  // 2. Section Identification
  let currentSection = null;
  const sectionContent = {};

  lines.forEach(line => {
    const lowerLine = line.toLowerCase().replace(/[:#\-_]/g, ' ').trim();

    // Check if line matches a known section header
    let headerFound = false;
    for (const [section, triggerWords] of Object.entries(keywords)) {
      if (triggerWords.some(word => lowerLine === word || lowerLine.startsWith(word + ' '))) {
        currentSection = section;
        if (!sectionContent[section]) sectionContent[section] = [];
        headerFound = true;
        break;
      }
    }

    if (!headerFound && currentSection) {
      sectionContent[currentSection].push(line);
    }
  });

  // 3. Consolidate Section Content
  for (const section in sectionContent) {
    if (sectionContent[section] && sectionContent[section].length > 0) {
      sections[section] = sectionContent[section].join('\n');
    }
  }

  return sections;
}

/**
 * Returns a normalized candidate object for editable form & DB persistence
 */
function parseStructuredCandidate(text) {
  const rawSections = parseResume(text);

  // Helper to extract items from bulleted or comma-separated lists
  const splitItems = (content) => {
    if (!content || content === 'Missing') return [];
    return content
      .split(/[\n,•|;]/)
      .map(s => s.trim().replace(/^[-*•]\s*/, ''))
      .filter(s => s.length > 1 && s.length < 80);
  };

  return {
    name: rawSections.Name !== 'Missing' ? rawSections.Name : '',
    email: rawSections.Email !== 'Missing' ? rawSections.Email : '',
    phone: rawSections.Phone !== 'Missing' ? rawSections.Phone : '',
    summary: rawSections.Summary !== 'Missing' ? rawSections.Summary : '',
    education: rawSections.Education !== 'Missing' ? rawSections.Education : '',
    experience: rawSections.Experience !== 'Missing' ? rawSections.Experience : '',
    skills: rawSections.Skills !== 'Missing' ? rawSections.Skills : '',
    skillsList: splitItems(rawSections.Skills),
    tools: rawSections.Tools !== 'Missing' ? rawSections.Tools : '',
    toolsList: splitItems(rawSections.Tools),
    certifications: rawSections.Certifications !== 'Missing' ? rawSections.Certifications : '',
    projects: rawSections.Projects !== 'Missing' ? rawSections.Projects : '',
    achievements: rawSections.Achievements !== 'Missing' ? rawSections.Achievements : '',
    rawText: text
  };
}

module.exports = { parseResume, parseStructuredCandidate };
