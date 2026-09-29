// Application-level domain guard.
//
// Level 1 classifies every user request deterministically before it reaches the
// model. Level 2 (the Gemini system instruction) enforces the same boundary
// independently. The guard is the access-control gate: the LLM is never the
// only thing keeping the copilot on-domain.

export type DomainCategory =
  | 'ARCHITECTURE'
  | 'CONSTRUCTION'
  | 'MATERIALS'
  | 'ESTIMATION'
  | 'BOQ'
  | 'PROJECT'
  | 'BUILDSMART'
  | 'GENERAL_GREETING'
  | 'OFF_TOPIC'
  | 'UNSAFE_TECHNICAL';

export type GuardResult =
  | {
      pass: true;
      category: Exclude<DomainCategory, 'OFF_TOPIC' | 'UNSAFE_TECHNICAL'>;
      mode: string;
    }
  | {
      pass: false;
      category: 'OFF_TOPIC' | 'UNSAFE_TECHNICAL';
      mode: string;
      response: string;
    };

const LAZY: Array<[Exclude<DomainCategory, 'GENERAL_GREETING' | 'OFF_TOPIC' | 'UNSAFE_TECHNICAL'>, string[]]> = [
  ['ARCHITECTURE', ['architecture', 'architectural', 'space planning', 'space plan', 'room layout', 'layout', 'zoning', 'circulation', 'daylight', 'natural light', 'ventilation', 'orientation', 'massing', 'building form', 'facade', 'facade', 'floor plan', 'floorplan', '3d model', '3d concept', 'residential design', 'commercial design', 'building type', 'design concept', 'spatial', 'adjacency', 'stairs', 'staircase', 'bedroom size', 'kitchen size', 'design review']],
  ['CONSTRUCTION', ['construction', 'build', 'building', 'foundation', 'foundations', 'walls', 'wall construction', 'floors', 'roof', 'roofing', 'ceiling', 'doors', 'windows', 'finishes', 'drainage', 'site prep', 'site preparation', 'waterproofing', 'damp', 'sequencing', 'constructability', 'concrete', 'formwork', 'masonry', 'excavation', 'retaining']],
  ['ESTIMATION', ['estimate', 'estimation', 'quantity', 'quantities', 'how many blocks', 'how much cement', 'how much sand', 'material quantity', 'unit conversion', 'waste allowance', 'preliminary cost', 'cost estimate']],
  ['BOQ', ['boq', 'bill of quantities', 'bill of quantity']],
  ['MATERIALS', ['materials', 'cement', 'concrete', 'sand', 'aggregates', 'blocks', 'bricks', 'steel', 'reinforcement', 'rebar', 'timber', 'roofing material', 'tiles', 'paint', 'glass', 'doors and windows', 'insulation', 'waterproofing material', 'material selection', 'material comparison', 'which material', 'durable materials', 'cost-effective materials']],
  ['PROJECT', ['project', 'client requirements', 'summary', 'summarize', 'task', 'tasks', 'pending', 'prioritize', 'checklist', 'schedule', 'timeline', 'program', 'procurement', 'milestone']],
  ['BUILDSMART', ['buildsmart', 'design studio', 'material estimation', 'marketplace', 'verification', 'subscription', 'dashboard', 'how do i', 'how to use', 'how to create', 'how to generate', 'how to review', 'how to upload', 'platform']],
];

const OFF_TOPIC = [
  'football', 'soccer', 'match', 'president', 'election', 'politics', 'political', 'romantic poem', 'poem', 'poetry',
  'recipe', 'cooking', 'movie', 'film', 'league', 'weather today', 'news', 'stocks', 'crypto', 'gossip', 'song',
  'write a story', 'essay about', 'python code', 'javascript code', 'computer code', 'math problem', 'history',
  'joke', 'horoscope', 'astrology', 'celebrity',
];

const UNSAFE = [
  'ignore previous', 'ignore all previous', 'ignore your instructions', 'forget your instructions', 'disregard',
  'system prompt', 'prompt', 'reveal', 'expose', 'developer message', 'api key', 'gemini api key', 'environment variable',
  'database credential', 'secret', 'password', 'jailbreak', 'do anything', 'unrestricted', 'act as', 'become a general',
  'switch to a general',
];

const GREETING = ['hello', 'hi', 'hey', 'good morning', 'good afternoon', 'good evening', 'thanks', 'thank you', 'great', 'cool', 'ok', 'okay'];

// Short conversational acknowledgements / follow-up requests that should not be
// treated as out-of-context even though they contain no domain keyword.
const CONVERSATIONAL_WORDS = new Set([
  'ok', 'okay', 'great', 'cool', 'thanks', 'thank you', 'yes', 'no', 'sure', 'right', 'got it',
  'tell me more', 'what else', 'continue', 'next', 'clarify', 'explain', 'more',
]);

const ON_TOPIC_WORDS = [
  'house', 'home', 'building', 'architect', 'architectural', 'design', 'project', 'plan', 'materials', 'material',
  'wall', 'roof', 'floor', 'space', 'room', 'kitchen', 'bedroom', 'bathroom', 'paint', 'cement', 'block', 'concrete',
  'estimate', 'estimation', 'cost', 'client', 'site', 'ventilation', 'lighting', 'layout', 'plot', 'planning', 'contractor', 'BOQ',
  'boq', 'foundation', 'foundations', 'foundation', 'drainage', 'roofing', 'tile', 'tiles', 'steel', 'rebar', 'timber',
  'facade', 'floorplan', 'floor plan', '3d', 'spatial', 'quantity', 'materials', 'material', 'drawing', 'blueprint',
  'construction', 'building', 'villa', 'house', 'home', 'apartment', 'office', 'storey', 'bathroom', 'bedroom',
  'window', 'windows', 'door', 'doors', 'opening', 'shading', 'orientation', 'massing', 'permits', 'regulation',
];

function normalize(text: string): string {
  return text.toLowerCase().replace(/\s+/g, ' ');
}

function containsAny(text: string, words: string[]): boolean {
  return words.some((w) => text.includes(w));
}

function dominantCategory(text: string): GuardResult['mode'] {
  const scores = LAZY.map(([cat, words]) => {
    const score = words.reduce((acc, w) => acc + (text.includes(w) ? 1 : 0), 0);
    return { cat, score };
  });
  const byCat = Object.fromEntries(scores.map((s) => [s.cat, s.score]));

  // Intent words ("estimate", "BOQ", "summarize project", "how do I use
  // BuildSmart", etc.) should win over incidental material/construction nouns.
  if (byCat.ESTIMATION > 0) return 'estimation';
  if (byCat.BOQ > 0) return 'boq';
  if (byCat.BUILDSMART > 0) return 'builds';
  if (byCat.PROJECT > 0) return 'project';

  const best = scores.sort((a, b) => b.score - a.score)[0];
  if (best && best.score > 0 && best.cat === 'MATERIALS') return 'materials';
  if (best && best.score > 0 && best.cat === 'CONSTRUCTION') return 'construction';
  if (best && best.score > 0 && best.cat === 'ARCHITECTURE') return 'architecture';
  return 'general';
}

function outOfContextResponse(): string {
  return "I cannot respond to questions that are outside my context. I am BuildSmart AI Copilot, and I only support architecture, construction, building materials, material estimation/BOQ, project planning, and BuildSmart AI platform functionality. For an architectural or construction question, feel free to ask me about your design, project, materials, quantities, or next steps.";
}

export function guardRequest(input: string): GuardResult {
  const text = normalize(input);
  const trimmed = text.trim();
  if (!trimmed) {
    return { pass: false, category: 'OFF_TOPIC', mode: 'general', response: outOfContextResponse() };
  }

  if (containsAny(text, UNSAFE)) {
    return {
      pass: false,
      category: 'UNSAFE_TECHNICAL',
      mode: 'general',
      response:
        "I cannot respond to that request. I am restricted to architecture, construction, building materials, project-related assistance, and BuildSmart AI functionality, and I will not reveal internal configuration. If you'd like, I can help with a design, material estimate, BOQ, or construction requirement.",
    };
  }

  const mode = dominantCategory(text);

  // Direct greetings.
  if (GREETING.includes(text)) {
    return { pass: true, category: 'GENERAL_GREETING', mode };
  }

  // Short conversational acknowledgements / follow-up requests.
  if (CONVERSATIONAL_WORDS.has(text) && text.split(/\s+/).length <= 3) {
    return { pass: true, category: 'ARCHITECTURE', mode: mode === 'general' ? 'architecture' : mode };
  }

  const hasOnTopicSignal = containsAny(text, ON_TOPIC_WORDS) || mode !== 'general';

  // Explicitly off-topic or with no architectural/construction signal at all.
  if (!hasOnTopicSignal || (containsAny(text, OFF_TOPIC) && !hasOnTopicSignal)) {
    return { pass: false, category: 'OFF_TOPIC', mode, response: outOfContextResponse() };
  }

  return { pass: true, category: mode === 'general' ? 'ARCHITECTURE' : uppercaseCategory(mode), mode };
}

function uppercaseCategory(mode: string): Exclude<DomainCategory, 'OFF_TOPIC' | 'UNSAFE_TECHNICAL' | 'GENERAL_GREETING'> {
  switch (mode) {
    case 'construction':
      return 'CONSTRUCTION';
    case 'materials':
      return 'MATERIALS';
    case 'estimation':
      return 'ESTIMATION';
    case 'boq':
      return 'BOQ';
    case 'project':
      return 'PROJECT';
    case 'builds':
      return 'BUILDSMART';
    default:
      return 'ARCHITECTURE';
  }
}
