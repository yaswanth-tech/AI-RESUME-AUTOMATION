const path = require('path');
const fs = require('fs');

class PromptRegistry {
  constructor(version = 'v1') {
    this.version = version;
    this.promptsRoot = path.join(__dirname, '../prompts', version);
    this.aliases = {
      atsPrompts: 'resume_analysis',
      resumeAnalysis: 'resume_analysis',
      jdAnalysis: 'job_description',
      resumeImprovements: 'resume_improvements',
      careerRoadmap: 'career_roadmap',
      opportunityRanking: 'opportunity_ranking',
      communicationAnalysis: 'communication_analysis',
      technicalQuestion: 'technical_question',
      mockInterview: 'mock_interview'
    };
  }

  get(templateName, variables = {}) {
    const filename = this.aliases[templateName] || templateName;
    if (!/^[a-z0-9_-]+$/i.test(filename)) throw new Error('Invalid prompt template name.');
    const filePath = path.join(this.promptsRoot, `${filename}.txt`);
    if (!filePath.startsWith(this.promptsRoot + path.sep) || !fs.existsSync(filePath)) {
      throw new Error(`Prompt template '${templateName}' is not available in ${this.version}.`);
    }
    let result = fs.readFileSync(filePath, 'utf8');
    for (const [key, value] of Object.entries(variables)) {
      const placeholder = `{{${key}}}`;
      result = result.split(placeholder).join(String(value));
    }
    return result;
  }
}

module.exports = new PromptRegistry();
