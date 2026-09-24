import express from 'express';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = 3000;

app.use(express.json({ limit: '10mb' }));

// Helper to initialize Google Gen AI
function getGenAI() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    return null;
  }
  return new GoogleGenAI({});
}

// Endpoint: Generate structured explanation
app.post('/api/explain', async (req, res) => {
  try {
    const { query, level = 'beginner', mode, context } = req.body;
    if (!query) {
      return res.status(400).json({ error: 'Query is required' });
    }

    const ai = getGenAI();
    if (!ai) {
      return res.status(200).json({
        fallback: true,
        message: 'Using offline educational engine'
      });
    }

    const systemPrompt = `You are Explanation Tutor: an AI designed to help people truly understand difficult concepts, not just provide raw answers.
Your motto: "AI that helps people understand, not just AI that gives answers."

Generate an educational breakdown for: "${query}"
Target Level: ${level} (beginner = intuitive everyday analogies; intermediate = mechanisms and cause/effect; deep_dive = edge cases, mathematical/architectural nuances).
${mode ? `Mode modifier: ${mode}` : ''}
${context ? `Context material: ${context}` : ''}

You MUST return a clean JSON object with this EXACT structure:
{
  "topic": "Clean capitalized topic name",
  "level": "${level}",
  "simpleExplanation": "2-3 crisp sentences explaining the core concept clearly without jargon.",
  "inSimpleWords": "An ELI5 explanation using a vivid, memorable everyday analogy (e.g., bakeries, traffic, post offices).",
  "realWorldExample": {
    "title": "Short relatable title",
    "scenario": "A concrete real-world situation demonstrating this concept.",
    "takeaway": "Key insight from this scenario."
  },
  "visualExplanation": {
    "title": "Diagram / Flow title",
    "type": "flow",
    "stages": [
      { "label": "Stage 1", "description": "Crisp description", "badge": "Input/Action" },
      { "label": "Stage 2", "description": "Crisp description", "badge": "Mechanism" },
      { "label": "Stage 3", "description": "Crisp description", "badge": "Outcome" }
    ],
    "caption": "Summary line or formula for the diagram"
  },
  "stepByStep": [
    { "stepNumber": 1, "title": "First phase", "explanation": "Clear explanation", "tip": "Helpful insight" },
    { "stepNumber": 2, "title": "Second phase", "explanation": "Clear explanation", "tip": "Helpful insight" },
    { "stepNumber": 3, "title": "Third phase", "explanation": "Clear explanation", "tip": "Helpful insight" }
  ],
  "keyTakeaways": [
    "Takeaway 1 (concise)",
    "Takeaway 2 (concise)",
    "Takeaway 3 (concise)",
    "Takeaway 4 (concise)"
  ],
  "checkUnderstanding": {
    "question": "A sharp multiple choice test question to check true conceptual understanding?",
    "options": [
      { "text": "Option A text", "isCorrect": false, "explanation": "Why this is incorrect or a common misconception." },
      { "text": "Option B text", "isCorrect": true, "explanation": "Why this is correct." },
      { "text": "Option C text", "isCorrect": false, "explanation": "Why this is incorrect." },
      { "text": "Option D text", "isCorrect": false, "explanation": "Why this is incorrect." }
    ],
    "hint": "A subtle hint directing their thinking."
  },
  "goDeeper": {
    "concept": "Advanced nuance or related breakthrough concept",
    "whyItMatters": "Why serious practitioners or researchers care about this nuance.",
    "curiousQuestion": "An intriguing question to spark further exploration."
  },
  "suggestedNext": [
    "Suggested related question 1?",
    "Suggested related question 2?",
    "Suggested related question 3?"
  ]
}`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: systemPrompt,
      config: {
        responseMimeType: 'application/json'
      }
    });

    const text = response.text;
    if (!text) {
      return res.status(200).json({ fallback: true });
    }

    const data = JSON.parse(text);
    return res.json({
      success: true,
      data: {
        ...data,
        id: 'gen-' + Date.now(),
        timestamp: Date.now()
      }
    });
  } catch (err: any) {
    console.error('Gemini explain error:', err?.message || err);
    return res.status(200).json({ fallback: true, error: err?.message });
  }
});

// Endpoint: Code Tutor debugging & explanation
app.post('/api/code-tutor', async (req, res) => {
  try {
    const { code, language = 'python', errorDescription = '' } = req.body;
    if (!code) {
      return res.status(400).json({ error: 'Code is required' });
    }

    const ai = getGenAI();
    if (!ai) {
      return res.status(200).json({ fallback: true });
    }

    const prompt = `You are Code Tutor in Explanation Tutor: AI that teaches programmers how to understand why bugs happen and how code works.
Code in ${language}:
\`\`\`
${code}
\`\`\`
User note / error description: "${errorDescription}"

Return a JSON object with this exact structure:
{
  "whatsWrong": "A clear, plain-language description of the bug or design issue.",
  "why": "The underlying computer science / language execution reason why this happens (memory, scope, timing, syntax, etc.).",
  "correctedCode": "The cleanly formatted, corrected code with comments.",
  "whatChanged": [
    "Bullet 1 explaining what was changed",
    "Bullet 2 explaining what was changed"
  ],
  "learnThisConcept": {
    "concept": "Name of the core programming concept (e.g. Pass by Reference, Closure Scope)",
    "explanation": "Why this concept is fundamental and how to remember it.",
    "ruleOfThumb": "A practical rule of thumb for future coding."
  },
  "tryItYourself": {
    "prompt": "A mini challenge testing the student on this fix",
    "starterCode": "Code snippet with a similar subtle flaw",
    "solutionCode": "The clean solution"
  }
}`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json'
      }
    });

    const text = response.text;
    if (!text) {
      return res.status(200).json({ fallback: true });
    }

    const data = JSON.parse(text);
    return res.json({ success: true, data });
  } catch (err: any) {
    console.error('Code tutor error:', err?.message || err);
    return res.status(200).json({ fallback: true, error: err?.message });
  }
});

// Endpoint: Analyze uploaded material
app.post('/api/analyze-material', async (req, res) => {
  try {
    const { title, content } = req.body;
    if (!content) {
      return res.status(400).json({ error: 'Content is required' });
    }

    const ai = getGenAI();
    if (!ai) {
      return res.status(200).json({ fallback: true });
    }

    const prompt = `Analyze this study material titled "${title}":
"""
${content.slice(0, 4000)}
"""

Extract structured educational insights in JSON:
{
  "summary": "2-3 sentence clear summary of the core thesis/subject.",
  "keyConcepts": [
    "Concept 1 with brief note",
    "Concept 2 with brief note",
    "Concept 3 with brief note",
    "Concept 4 with brief note"
  ],
  "recommendedQuestions": [
    "Inquisitive question 1 to test understanding?",
    "Inquisitive question 2 to test understanding?",
    "Inquisitive question 3 to test understanding?"
  ]
}`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json'
      }
    });

    const text = response.text;
    if (!text) {
      return res.status(200).json({ fallback: true });
    }

    const data = JSON.parse(text);
    return res.json({ success: true, data });
  } catch (err: any) {
    console.error('Analyze material error:', err?.message || err);
    return res.status(200).json({ fallback: true, error: err?.message });
  }
});

// Setup Vite middleware for development
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`Explanation Tutor server listening on http://0.0.0.0:${port}`);
  });
}

startServer();
