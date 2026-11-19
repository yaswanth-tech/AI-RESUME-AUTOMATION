const crypto = require('crypto');
const OpenAI = require('openai');
const { z } = require('zod');
const fs = require('fs');
const path = require('path');

const PROMPT_VERSION = 'v1';
const promptsRoot = path.join(__dirname, '../prompts', PROMPT_VERSION);
const cache = new Map();
const cacheTtlMs = Math.max(0, Number(process.env.AI_CACHE_TTL_SECONDS || 86400)) * 1000;
const maxInputChars = Math.min(20000, Math.max(1000, Number(process.env.AI_MAX_INPUT_CHARS || 12000)));
const maxItems = z.array(z.string().trim().min(1).max(300)).max(40);
const evidenceSchema = z.array(z.object({ field: z.string().min(1).max(40), quote: z.string().min(1).max(400) }).strict()).max(12);
const analysisEntry = z.object({ item: z.string().min(1).max(300), why: z.string().min(8).max(1000), evidence: evidenceSchema }).strict();
const analysisSchema = z.object({
  strengths: z.array(analysisEntry).max(20),
  weaknesses: z.array(analysisEntry).max(20),
  missingInfo: z.array(analysisEntry).max(20),
  suggestions: z.array(analysisEntry).max(20)
}).strict();
const jdSchema = z.object({
  title: z.string().min(1).max(200), requiredSkills: maxItems, preferredQualifications: maxItems,
  responsibilities: maxItems, requiredExperience: maxItems, preferredSkills: maxItems,
  educationRequirements: maxItems, toolsTechnologies: maxItems
}).strict();
const improvementSchema = z.object({
  summaryRewrite: z.string().max(2000), summaryReason: z.string().min(8).max(1000), summaryEvidence: z.array(z.string().min(1).max(400)).max(8),
  bulletRewrites: z.array(z.object({ originalBullet: z.string().min(1).max(2000), improvedBullet: z.string().min(1).max(2000), reason: z.string().min(8).max(1000) }).strict()).max(20),
  skillsToHighlight: maxItems, structureAdvice: maxItems, missingSections: maxItems, roleAdvice: maxItems
}).strict();

function prompt(name) {
  return fs.readFileSync(path.join(promptsRoot, `${name}.txt`), 'utf8');
}

function redact(value) {
  return String(value || '')
    .replace(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g, '[EMAIL]')
    .replace(/(?:\+?\d[\d ().-]{7,}\d)/g, '[PHONE]')
    .replace(/https?:\/\/\S+/gi, '[URL]')
    .replace(/\b\d{1,6}\s+[\w.'-]+\s+(?:street|st\.|road|rd\.|avenue|ave\.|boulevard|blvd\.)\b[^\n,]*/gi, '[ADDRESS]');
}

function candidateSource(candidateData) {
  return Object.entries(candidateData || {})
    .filter(([key, value]) => !['rawText', 'name', 'email', 'phone', 'skillsList', 'toolsList'].includes(key) && typeof value === 'string' && value.trim())
    .map(([field, value]) => `${field}: ${redact(value).slice(0, 3000)}`).join('\n').slice(0, maxInputChars);
}

function validEvidence(items, source) {
  const lower = source.toLowerCase();
  return items.every(item => item.evidence.every(ev => lower.includes(ev.quote.toLowerCase())));
}

function cacheKey(task, source, context = '', userId = '') {
  return crypto.createHash('sha256').update([userId, task, PROMPT_VERSION, process.env.AI_MODEL || process.env.OPENAI_MODEL || 'gpt-6-luna', source, context].join('\0')).digest('hex');
}

class AIProviderService {
  constructor() {
    this.provider = (process.env.AI_PROVIDER || 'openai').toLowerCase();
    this.modelName = process.env.AI_MODEL || process.env.OPENAI_MODEL || 'gpt-6-luna';
    this.client = this.provider === 'openai' && process.env.OPENAI_API_KEY
      ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY, timeout: Math.max(1000, Number(process.env.AI_TIMEOUT_MS || 20000)), maxRetries: 0 })
      : null;
  }

  isAIAvailable() {
    return process.env.AI_ENABLED === 'true' && Boolean(this.client);
  }

  async callStructured(task, userContent, schema, validator, sourceForEvidence = '', userId = '') {
    if (!this.isAIAvailable()) throw new Error('AI is disabled or not configured.');
    const key = cacheKey(task, userContent, '', userId);
    const cached = cache.get(key);
    if (cached && cached.expiresAt > Date.now()) return cached.value;
    cache.delete(key);
    let lastError;
    let safeValidationError = '';
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const startedAt = Date.now();
        const result = await this.client.responses.create({
          model: this.modelName,
          store: false,
          input: [
            { role: 'system', content: prompt(task) },
            { role: 'user', content: `${attempt ? `Correct this validation issue: ${safeValidationError}. Return only a valid object.\n` : ''}${userContent}` }
          ],
          text: { format: { type: 'json_schema', name: task.replace(/[^a-z0-9_]/gi, '_'), strict: true, schema } }
        });
        const parsed = validator.parse(JSON.parse(result.output_text));
        if (sourceForEvidence && parsed.strengths && !validEvidence([...parsed.strengths, ...parsed.weaknesses, ...parsed.missingInfo, ...parsed.suggestions], sourceForEvidence)) {
          throw new Error('Evidence quote did not match the redacted resume source.');
        }
        if (cacheTtlMs) {
          if (cache.size >= 1000) cache.delete(cache.keys().next().value);
          cache.set(key, { value: parsed, expiresAt: Date.now() + cacheTtlMs });
        }
        const inputTokens = result.usage?.input_tokens || null;
        const outputTokens = result.usage?.output_tokens || null;
        const knownRates = this.modelName === 'gpt-6-luna' ? { input: 0.10, output: 0.50 } : { input: 0, output: 0 };
        const inputRate = process.env.AI_INPUT_COST_PER_MILLION != null
          ? Number(process.env.AI_INPUT_COST_PER_MILLION) : knownRates.input;
        const outputRate = process.env.AI_OUTPUT_COST_PER_MILLION != null
          ? Number(process.env.AI_OUTPUT_COST_PER_MILLION) : knownRates.output;
        const estimatedCostUsd = inputTokens != null && outputTokens != null && (inputRate || outputRate)
          ? (inputTokens * inputRate + outputTokens * outputRate) / 1_000_000 : null;
        console.info(JSON.stringify({ event: 'ai_request', provider: this.provider, model: this.modelName, task, elapsedMs: Date.now() - startedAt, inputTokens, outputTokens, estimatedCostUsd, fallback: false }));
        return parsed;
      } catch (error) {
        lastError = error;
        safeValidationError = error instanceof z.ZodError
          ? error.issues.map(issue => `${issue.path.join('.')}: ${issue.message}`).join('; ').slice(0, 500)
          : 'output was invalid or provider request failed';
        if (attempt === 0) continue;
      }
    }
    console.warn(JSON.stringify({ event: 'ai_fallback', task, reason: lastError?.name || 'provider_or_validation_error' }));
    throw lastError || new Error('Structured AI request failed.');
  }

  async analyzeResume(candidateData, targetRole = 'Software Engineer', userId = '') {
    const source = candidateSource(candidateData);
    const userContent = `Target role: ${String(targetRole).slice(0, 80)}\nResume sections:\n${source}`;
    try {
      const output = await this.callStructured('resume_analysis', userContent, analysisJsonSchema, analysisSchema, source, userId);
      return { ...output, source: `AI (${this.modelName})`, promptVersion: PROMPT_VERSION };
    } catch {
      return this.ruleBasedResumeAnalysis(candidateData, targetRole);
    }
  }

  ruleBasedResumeAnalysis(candidateData, targetRole) {
    const source = candidateSource(candidateData);
    const quoteFor = field => {
      const value = candidateData?.[field];
      return typeof value === 'string' && value.trim() ? [{ field, quote: redact(value.trim()).slice(0, 200) }] : [];
    };
    const strengths = [];
    const weaknesses = [];
    const missingInfo = [];
    const suggestions = [];
    if (candidateData?.skills) strengths.push({ item: 'Skills are documented', why: 'The resume includes a skills section that can be compared with a target role.', evidence: quoteFor('skills') });
    if (candidateData?.experience) strengths.push({ item: 'Work experience is documented', why: 'The resume includes experience text that can be reviewed for role relevance.', evidence: quoteFor('experience') });
    else if (candidateData?.projects) strengths.push({ item: 'Project experience is documented', why: 'The resume includes project details that can demonstrate applied work.', evidence: quoteFor('projects') });
    if (!candidateData?.summary) {
      missingInfo.push({ item: 'Professional summary not detected', why: 'No professional summary was extracted; add one only if you can verify its factual claims.', evidence: [] });
      suggestions.push({ item: 'Consider adding a professional summary', why: 'A summary is not present in the parsed source, so readers may need to infer your focus from other sections.', evidence: quoteFor('experience').concat(quoteFor('skills')).slice(0, 2) });
    } else {
      const quote = quoteFor('summary');
      weaknesses.push({ item: 'Review the summary for role alignment', why: `Compare the existing summary with the stated target role (${String(targetRole).slice(0, 80)}).`, evidence: quote });
      suggestions.push({ item: 'Review the summary for role alignment', why: 'The current summary is available to tailor after confirming each statement is accurate.', evidence: quote });
    }
    if (!candidateData?.education) missingInfo.push({ item: 'Education not detected', why: 'No education section was extracted from the resume text.', evidence: [] });
    if (!candidateData?.certifications) missingInfo.push({ item: 'Certifications not detected', why: 'No certification section was extracted; add credentials only when completed and verifiable.', evidence: [] });
    if (!source) weaknesses.push({ item: 'No readable resume sections available', why: 'The parser did not provide usable resume section text for analysis.', evidence: [] });
    return { source: 'Rule-Based Engine (Deterministic Fallback)', strengths, weaknesses, missingInfo, suggestions, promptVersion: PROMPT_VERSION };
  }

  async parseJobDescription(jdText, targetRole = '', userId = '') {
    const cleanText = redact(jdText).slice(0, maxInputChars);
    try {
      const output = await this.callStructured('job_description', `Target role: ${String(targetRole).slice(0, 80)}\nJob description:\n${cleanText}`, jdJsonSchema, jdSchema, '', userId);
      return { ...output, experience: output.requiredExperience.join('; ') || 'Not explicitly specified', education: output.educationRequirements.join('; ') || 'Not explicitly specified', source: `AI (${this.modelName})`, promptVersion: PROMPT_VERSION };
    } catch {
      return this.ruleBasedJDParser(cleanText, targetRole);
    }
  }

  ruleBasedJDParser(jdText, targetRole = '') {
    const lines = String(jdText || '').split(/\r?\n/).map(line => line.trim()).filter(Boolean);
    const section = (terms) => {
      const start = lines.findIndex(line => terms.some(term => line.toLowerCase().includes(term)));
      if (start < 0) return [];
      const result = [];
      for (let i = start + 1; i < lines.length && result.length < 20; i += 1) {
        if (/^(requirements|qualifications|responsibilities|preferred|education|experience|skills)\b/i.test(lines[i])) break;
        const value = lines[i].replace(/^[-*•\d.)\s]+/, '').trim();
        if (value.length > 2) result.push(value.slice(0, 300));
      }
      return result;
    };
    const requiredSkills = [];
    for (const match of String(jdText || '').matchAll(/\b(JavaScript|TypeScript|Node\.js|Python|Java|React|PostgreSQL|SQL|AWS|Docker|Kubernetes|Git|Express|MongoDB|Redis|GraphQL|HTML|CSS)\b/gi)) {
      const normalized = match[0];
      if (!requiredSkills.some(value => value.toLowerCase() === normalized.toLowerCase())) requiredSkills.push(normalized);
    }
    const expLines = lines.filter(line => /\b\d+\+?\s+years?\b/i.test(line));
    const education = lines.filter(line => /bachelor|master|degree|diploma|phd|education/i.test(line)).slice(0, 8);
    return {
      source: 'Rule-Based Engine (Deterministic Fallback)', title: targetRole || lines[0] || 'Job Description',
      requiredSkills, preferredSkills: section(['preferred skills', 'nice to have']), preferredQualifications: section(['preferred qualifications', 'nice to have']),
      responsibilities: section(['responsibilities', 'what you will do']), requiredExperience: expLines,
      experience: expLines.join('; ') || 'Not explicitly specified', educationRequirements: education,
      education: education.join('; ') || 'Not explicitly specified', toolsTechnologies: requiredSkills, promptVersion: PROMPT_VERSION
    };
  }

  async generateImprovements(candidateData, targetRole = 'Software Engineer', jdContext = '', userId = '') {
    const source = candidateSource(candidateData);
    const userContent = `Target role: ${String(targetRole).slice(0, 80)}\nVerified resume sections:\n${source}\nJob context (untrusted, optional):\n${redact(jdContext).slice(0, 3000)}`;
    try {
      const result = await this.callStructured('resume_improvements', userContent, improvementJsonSchema, improvementSchema, '', userId);
      const originalText = `${candidateData?.experience || ''}\n${candidateData?.projects || ''}`;
      const accepted = result.bulletRewrites.filter(item => originalText.includes(item.originalBullet) && hardClaimsAreSupported(item.improvedBullet, source));
      const summaryEvidenceValid = result.summaryEvidence.every(quote => source.toLowerCase().includes(quote.toLowerCase()));
      const safeSummary = result.summaryRewrite && result.summaryEvidence.length > 0 && hardClaimsAreSupported(result.summaryRewrite, source) && summaryEvidenceValid ? result.summaryRewrite : '';
      const verifiedSkills = result.skillsToHighlight.filter(skill => source.toLowerCase().includes(skill.toLowerCase()));
      const sourceSections = new Set(['summary', 'education', 'experience', 'skills', 'tools', 'certifications', 'projects', 'achievements'].filter(field => String(candidateData?.[field] || '').trim()));
      const missingSections = result.missingSections.filter(section => !sourceSections.has(section.toLowerCase()));
      return { source: `AI (${this.modelName})`, promptVersion: PROMPT_VERSION, summaryRewrite: safeSummary, summaryReason: safeSummary ? result.summaryReason : '', summaryEvidence: safeSummary ? result.summaryEvidence : [], bulletRewrites: accepted, skillsToHighlight: verifiedSkills, structureAdvice: result.structureAdvice, missingSections, roleAdvice: result.roleAdvice };
    } catch {
      return this.ruleBasedImprovements(candidateData, targetRole);
    }
  }

  ruleBasedImprovements(candidateData, targetRole) {
    const summary = (candidateData?.summary || '').trim();
    const bulletText = `${candidateData?.experience || ''}\n${candidateData?.projects || ''}`;
    const bullets = bulletText.split(/\r?\n/).map(line => line.trim()).filter(line => line.length > 15 && line.length < 200);
    return {
      source: 'Rule-Based Engine (Deterministic Fallback)', promptVersion: PROMPT_VERSION,
      summaryRewrite: summary,
      summaryReason: summary ? 'The existing summary is preserved as-is because no verified rewrite is available in deterministic mode.' : 'No summary was extracted; enter a factual summary yourself if you want one.',
      summaryEvidence: summary ? [summary.slice(0, 300)] : [],
      bulletRewrites: bullets.slice(0, 8).map((line, index) => ({ id: `rewrite_${index + 1}`, originalBullet: line.replace(/^[-*•]\s*/, ''), improvedBullet: line.replace(/^[-*•]\s*/, ''), reason: `Preserved the original statement without adding facts; review whether it clearly supports the ${String(targetRole).slice(0, 80)} role.` })),
      skillsToHighlight: candidateData?.skillsList || String(candidateData?.skills || '').split(/[,;\n]/).map(item => item.trim()).filter(Boolean),
      structureAdvice: ['Review whether your strongest verified experience and project sections are easy to find.'],
      missingSections: ['summary', 'education', 'experience', 'skills', 'tools', 'certifications', 'projects', 'achievements'].filter(field => !String(candidateData?.[field] || '').trim()),
      roleAdvice: [`Compare the ${String(targetRole).slice(0, 80)} requirements with only the skills and experience already documented.`]
    };
  }
}

function hardClaimsAreSupported(output, source) {
  const lowerSource = source.toLowerCase();
  const numericFacts = output.match(/\b\d[\d,.]*(?:\+|%|\s*(?:years?|users?|clients?|requests?|records?|ms|seconds?))?\b/gi) || [];
  if (!numericFacts.every(value => lowerSource.includes(value.toLowerCase()))) return false;
  const technicalTerms = output.match(/\b(?:JavaScript|TypeScript|Node\.?js|Python|Java|C\+\+|C#|React|Next\.js|Angular|Vue|Express|PostgreSQL|MySQL|MongoDB|Redis|GraphQL|REST|AWS|Azure|GCP|Docker|Kubernetes|GitHub|GitLab|Jest|CI\/CD|Linux|Terraform|OAuth|JWT|HTML5?|CSS3?|Tailwind|Sass|Figma|Postman)\b/gi) || [];
  if (!technicalTerms.every(value => lowerSource.includes(value.toLowerCase()))) return false;
  const credentialPhrases = output.match(/\b(?:Bachelor|Master|Doctorate|PhD|B\.Tech|M\.Tech|certified|certification|certificate|PMP|CISSP|AWS Certified)[^.;,\n]{0,80}/gi) || [];
  if (!credentialPhrases.every(value => lowerSource.includes(value.toLowerCase()))) return false;
  const ordinaryWords = new Set(['dedicated', 'experienced', 'proven', 'results', 'skilled', 'professional', 'software', 'engineer', 'developer', 'built', 'developed', 'implemented', 'designed', 'created', 'managed', 'led', 'architected', 'optimized', 'improved', 'collaborative', 'demonstrated', 'strong', 'working', 'focused', 'contributed']);
  const namedFacts = output.match(/\b[A-Z][A-Za-z0-9+.#&-]{2,}\b/g) || [];
  if (!namedFacts.every(value => ordinaryWords.has(value.toLowerCase()) || lowerSource.includes(value.toLowerCase()))) return false;
  return true;
}

const analysisJsonSchema = {
  type: 'object', additionalProperties: false, required: ['strengths', 'weaknesses', 'missingInfo', 'suggestions'], properties: Object.fromEntries(
    ['strengths', 'weaknesses', 'missingInfo', 'suggestions'].map(key => [key, { type: 'array', maxItems: 20, items: { type: 'object', additionalProperties: false, required: ['item', 'why', 'evidence'], properties: { item: { type: 'string' }, why: { type: 'string' }, evidence: { type: 'array', maxItems: 12, items: { type: 'object', additionalProperties: false, required: ['field', 'quote'], properties: { field: { type: 'string' }, quote: { type: 'string' } } } } } } }])
  )
};
const jdJsonSchema = {
  type: 'object', additionalProperties: false,
  required: ['title', 'requiredSkills', 'preferredQualifications', 'responsibilities', 'requiredExperience', 'preferredSkills', 'educationRequirements', 'toolsTechnologies'],
  properties: Object.fromEntries(['title', 'requiredSkills', 'preferredQualifications', 'responsibilities', 'requiredExperience', 'preferredSkills', 'educationRequirements', 'toolsTechnologies'].map(key => [key, key === 'title' ? { type: 'string' } : { type: 'array', maxItems: 40, items: { type: 'string' } }]))
};
const improvementJsonSchema = {
  type: 'object', additionalProperties: false, required: ['summaryRewrite', 'summaryReason', 'summaryEvidence', 'bulletRewrites', 'skillsToHighlight', 'structureAdvice', 'missingSections', 'roleAdvice'],
  properties: { summaryRewrite: { type: 'string' }, summaryReason: { type: 'string' }, summaryEvidence: { type: 'array', maxItems: 8, items: { type: 'string' } }, bulletRewrites: { type: 'array', maxItems: 20, items: { type: 'object', additionalProperties: false, required: ['originalBullet', 'improvedBullet', 'reason'], properties: { originalBullet: { type: 'string' }, improvedBullet: { type: 'string' }, reason: { type: 'string' } } } }, skillsToHighlight: { type: 'array', maxItems: 40, items: { type: 'string' } }, structureAdvice: { type: 'array', maxItems: 40, items: { type: 'string' } }, missingSections: { type: 'array', maxItems: 40, items: { type: 'string' } }, roleAdvice: { type: 'array', maxItems: 40, items: { type: 'string' } } }
};

module.exports = new AIProviderService();
module.exports.AIProviderService = AIProviderService;
module.exports.hardClaimsAreSupported = hardClaimsAreSupported;
module.exports.candidateSource = candidateSource;
