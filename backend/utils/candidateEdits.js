const TEXT_FIELDS = [
  'name', 'email', 'phone', 'summary', 'education', 'experience',
  'skills', 'certifications', 'projects', 'tools', 'achievements'
];

function fail(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function splitList(content) {
  if (!content) return [];
  return content
    .split(/[\n,•|;]/)
    .map(item => item.trim().replace(/^[-*•]\s*/, ''))
    .filter(item => item.length > 1 && item.length < 80);
}

function sanitizeCandidateUpdate(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw fail(400, 'candidateData must be an object.');
  }

  const out = {};
  for (const field of TEXT_FIELDS) {
    const value = input[field];
    if (value == null || value === '') {
      out[field] = '';
      continue;
    }
    if (typeof value !== 'string') {
      throw fail(400, `${field} must be text.`);
    }
    if (value.length > 20000) {
      throw fail(400, `${field} exceeds the 20000 character limit.`);
    }
    out[field] = value.trim();
  }

  if (out.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(out.email)) {
    throw fail(400, 'Email format is invalid.');
  }
  if (out.phone && !/^[0-9+().\-\s]{7,20}$/.test(out.phone)) {
    throw fail(400, 'Phone format is invalid.');
  }

  out.skillsList = splitList(out.skills);
  out.toolsList = splitList(out.tools);
  return out;
}

function replaceInText(text, original, improved) {
  if (!text || typeof text !== 'string') return null;
  const lines = text.split(/\r?\n/);
  const needle = original.trim();
  let replaced = false;

  const next = lines.map(line => {
    if (replaced) return line;
    const stripped = line.trim().replace(/^[-*•]\s*/, '');
    if (stripped === needle || line.includes(needle)) {
      replaced = true;
      const marker = line.match(/^\s*([-*•])\s*/);
      return marker ? `${marker[1]} ${improved}` : improved;
    }
    return line;
  });

  return replaced ? next.join('\n') : null;
}

function replaceBullet(parsed, originalBullet, improvedBullet) {
  if (!originalBullet || typeof originalBullet !== 'string' || !improvedBullet || typeof improvedBullet !== 'string') {
    throw fail(400, 'originalBullet and acceptedText are required to replace a bullet.');
  }
  if (improvedBullet.length > 2000) {
    throw fail(400, 'Replacement bullet is too long.');
  }

  const next = { ...parsed };
  const sections = ['experience', 'projects', 'achievements'];
  for (const section of sections) {
    const updated = replaceInText(next[section], originalBullet, improvedBullet.trim());
    if (updated != null) {
      next[section] = updated;
      return next;
    }
  }

  throw fail(400, 'That original bullet was not found on the resume, so nothing was added.');
}

function isOwner(record, userId) {
  return Boolean(record && userId && record.userId === userId);
}

module.exports = {
  sanitizeCandidateUpdate,
  replaceBullet,
  isOwner,
  splitList
};
