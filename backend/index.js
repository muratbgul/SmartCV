
require('dotenv').config();
const express = require('express');
const multer = require('multer');
const cors = require('cors');
const { getDocument } = require('pdfjs-dist/legacy/build/pdf.mjs');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const nlp = require('compromise');

const app = express();
const port = 5000;

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

const storage = multer.memoryStorage();
const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed'), false);
    }
  }
});

app.post('/upload-pdf', upload.single('pdf'), async (req, res) => {
  console.log('Received upload-pdf request.');
  
  if (req.fileValidationError) {
    return res.status(400).json({ error: req.fileValidationError });
  }
  
  if (!req.file) {
    console.log('No PDF file uploaded.');
    return res.status(400).json({ error: 'No PDF file uploaded.' });
  }

  const MAX_FILE_SIZE = 10 * 1024 * 1024;
  if (req.file.size > MAX_FILE_SIZE) {
    return res.status(400).json({ 
      error: 'File too large',
      message: `File size exceeds maximum allowed size of ${MAX_FILE_SIZE / (1024 * 1024)}MB`
    });
  }

  console.log(`File received: ${req.file.originalname}, size: ${req.file.size} bytes, mimetype: ${req.file.mimetype}`);

  try {
    const pdfBuffer = req.file.buffer;
    const uint8Array = new Uint8Array(pdfBuffer);
    console.log('Attempting to parse PDF with pdfjs-dist...');

    const pdfDocument = await getDocument({ data: uint8Array }).promise;
    let fullText = '';

    for (let i = 1; i <= pdfDocument.numPages; i++) {
      const page = await pdfDocument.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map(item => item.str).join(' ');
      fullText += pageText + '\n';
    }

    console.log('PDF parsed successfully with pdfjs-dist.');
    console.log('Extracted text (first 500 chars):', fullText.substring(0, 500));

    const doc = nlp(fullText);

    let name = null;

    const topText = fullText.substring(0, Math.min(fullText.length, 1500));
    
    const cleanedTopText = topText.replace(/[\w.-]+@[\w.-]+\.[a-zA-Z]{2,}/g, '')
                                   .replace(/\+?\d[\d\s.-]{8,}/g, '');
    
    const excludedWords = [
        'NEAR', 'EAST', 'WEST', 'NORTH', 'SOUTH', 'UNIVERSITY', 'COLLEGE', 'INSTITUTE',
        'CONTACT', 'SKILLS', 'EDUCATION', 'EXPERIENCE', 'WORK', 'PROJECTS', 'LANGUAGES',
        'SOFTWARE', 'ENGINEER', 'DEVELOPER', 'ENHANCED', 'ENHANC', 'PROFESSIONAL'
    ];
    
    const allCapsNameRegex = /\b([A-ZÇĞİÖŞÜ]{3,})\s+([A-ZÇĞİÖŞÜ]{3,})\b/g;
    const allCapsMatches = cleanedTopText.match(allCapsNameRegex);
    
    if (allCapsMatches && allCapsMatches.length > 0) {
        const validAllCapsNames = allCapsMatches.filter(match => {
            const upperMatch = match.toUpperCase();
            const words = match.split(/\s+/);
            
            if (words.length !== 2) return false;
            
            const hasExcludedWord = excludedWords.some(excluded => upperMatch.includes(excluded));
            const eachWordLongEnough = words.every(w => w.length >= 4);
            const allUpperCase = words.every(word => word === word.toUpperCase());
            
            return !hasExcludedWord && eachWordLongEnough && allUpperCase;
        });
        
        if (validAllCapsNames.length > 0) {
            name = validAllCapsNames[0].trim();
        }
    }
    
    if (!name) {
        const turkishNamePattern = /\b([A-ZÇĞİÖŞÜ][a-zçğıöşü]{2,})\s+([A-ZÇĞİÖŞÜ][a-zçğıöşü]{2,})\b/g;
        const turkishNameMatches = cleanedTopText.match(turkishNamePattern);
        
        if (turkishNameMatches && turkishNameMatches.length > 0) {
            const validTurkishNames = turkishNameMatches.filter(match => {
                const words = match.split(/\s+/);
                if (words.length !== 2) return false;
                
                const upperMatch = match.toUpperCase();
                const hasExcludedWord = excludedWords.some(excluded => upperMatch.includes(excluded));
                const eachWordLongEnough = words.every(w => w.length >= 3);
                
                return !hasExcludedWord && eachWordLongEnough;
            });
            
            if (validTurkishNames.length > 0) {
                name = validTurkishNames[0].trim();
            }
        }
    }
    
    if (!name) {
        const contextualNameRegex = /(?:name|full\s*name|candidate)\s*:?\s*([A-ZÇĞİÖŞÜ][a-zçğıöşü]+(?:\s+[A-ZÇĞİÖŞÜ][a-zçğıöşü]+){1,3})/i;
        const contextualNameMatch = topText.match(contextualNameRegex);
        if (contextualNameMatch && contextualNameMatch[1]) {
            name = contextualNameMatch[1].trim();
        }
    }
    
    if (!name) {
        const possibleNames = doc.people().out('array');
        const filteredNames = possibleNames.filter(p => {
            const words = p.split(' ');
            return words.length >= 2 && words.length <= 4;
        });
        if (filteredNames.length > 0) {
            name = filteredNames[0];
        }
    }

    const emails = doc.emails().out('array');
        
    let phone = null;
        
    const nlpPhoneNumbers = doc.phoneNumbers().out('array');
    if (nlpPhoneNumbers.length > 0) {
        phone = nlpPhoneNumbers[0];
    }
        
    if (!phone) {
        const phonePatterns = [
            /\+?\d{1,4}[\s.-]?\(?\d{1,4}\)?[\s.-]?\d{1,4}[\s.-]?\d{1,4}[\s.-]?\d{1,9}/g,
            /\+?\d{2,3}[\s.-]?\d{3}[\s.-]?\d{3}[\s.-]?\d{2,4}[\s.-]?\d{2}/g,
            /\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/g,
            /\d{10,}/g
        ];
            
        for (const pattern of phonePatterns) {
            const matches = fullText.match(pattern);
            if (matches && matches.length > 0) {
                const validPhone = matches.find(m => m.replace(/\D/g, '').length >= 10);
                if (validPhone) {
                    phone = validPhone.trim();
                    break;
                }
            }
        }
    }

    const skillsKeywords = [
      'HTML', 'HTML5', 'CSS', 'CSS3', 'JavaScript', 'TypeScript', 'React', 'React.js',
      'Node.js', 'Python', 'Angular', 'Next.js', 'Tailwind', 'Bootstrap', 'Vue.js',
      'Vue', 'Express', 'Express.js', 'MongoDB', 'PostgreSQL', 'MySQL', 'SQL',
      'Git', 'GitHub', 'Docker', 'Kubernetes', 'AWS', 'Azure', 'GCP', 'Firebase',
      'Redux', 'MobX', 'GraphQL', 'REST', 'API', 'Jest', 'Testing', 'JUnit',
      'Selenium', 'Cypress', 'Webpack', 'Vite', 'NPM', 'Yarn', 'Linux', 'Unix',
      'Java', 'C++', 'C#', '.NET', 'PHP', 'Ruby', 'Go', 'Rust', 'Swift', 'Kotlin',
      'Django', 'Flask', 'Spring', 'Laravel', 'Rails', 'TensorFlow', 'PyTorch',
      'Machine Learning', 'AI', 'Deep Learning', 'Data Science', 'Pandas', 'NumPy',
      'Scikit-learn', 'Tableau', 'Power BI', 'Excel', 'Agile', 'Scrum', 'DevOps',
      'CI/CD', 'Jenkins', 'Travis CI', 'CircleCI', 'GitLab CI', 'Microservices',
      'Serverless', 'Lambda', 'S3', 'EC2', 'RDS', 'DynamoDB', 'Redis', 'Elasticsearch'
    ];
    const extractedSkills = skillsKeywords.filter(keyword =>
      new RegExp(`\\b${keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(fullText)
    );

    let experience = null;
    let education = null;

    const lines = fullText.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    const parsedSections = {};
    let currentSectionKey = null;

    const sectionHeadersMap = {
        'CONTACT': 'CONTACT', 'İLETİŞİM': 'CONTACT',
        'SKILLS': 'SKILLS', 'BECERİLER': 'SKILLS',
        'WORK EXPERIENCE': 'EXPERIENCE', 'DENEYİM': 'EXPERIENCE',
        'EDUCATION': 'EDUCATION', 'EĞİTİM': 'EDUCATION',
        'PROJECTS': 'PROJECTS', 'PROJELER': 'PROJECTS',
        'REFERENCES': 'REFERENCES', 'REFERANSLAR': 'REFERENCES',
        'LANGUAGES': 'LANGUAGES', 'DİLLER': 'LANGUAGES',
        'AWARDS': 'AWARDS', 'ÖDÜLLER': 'AWARDS',
        'CERTIFICATIONS': 'CERTIFICATIONS', 'SERTİFİKALAR': 'CERTIFICATIONS',
        'INTERESTS': 'INTERESTS', 'HOBİLER': 'INTERESTS'
    };

    const headerPattern = Object.keys(sectionHeadersMap).map(h => h.replace(/ /g, '\\s*')).join('|');
    const headerRegex = new RegExp(`^(${headerPattern})$`, 'i');

    for (const line of lines) {
        const match = line.match(headerRegex);
        if (match) {
            const matchedHeaderOriginalKey = Object.keys(sectionHeadersMap).find(key =>
                new RegExp(`^${key.replace(/ /g, '\\s*')}$`, 'i').test(match[1])
            );
            
            if (matchedHeaderOriginalKey) {
                currentSectionKey = sectionHeadersMap[matchedHeaderOriginalKey];
                if (!parsedSections[currentSectionKey]) {
                    if (currentSectionKey === 'EXPERIENCE' || currentSectionKey === 'EDUCATION') {
                        parsedSections[currentSectionKey] = [];
                    } else {
                        parsedSections[currentSectionKey] = '';
                    }
                }
            } else {
                currentSectionKey = null;
            }
        } else if (currentSectionKey) {
            if (currentSectionKey === 'EXPERIENCE' || currentSectionKey === 'EDUCATION') {
                const isNewEntry = /^(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|Ocak|Şubat|Mart|Nisan|Mayıs|Haziran|Temmuz|Ağustos|Eylül|Ekim|Kasım|Aralık|\d{4})/.test(line) ||
                                 /^[A-ZÇĞİÖŞÜ][a-zçğıöşü0-9.,\s&-]+$/.test(line);

                if (parsedSections[currentSectionKey].length === 0 || isNewEntry) {
                    parsedSections[currentSectionKey].push(line);
                } else {
                    parsedSections[currentSectionKey][parsedSections[currentSectionKey].length - 1] += '\n' + line;
                }
            } else {
                parsedSections[currentSectionKey] += line + '\n';
            }
        }
    }

    if (parsedSections.EXPERIENCE && parsedSections.EXPERIENCE.length > 0) {
        experience = parsedSections.EXPERIENCE.join('\n').trim();
    }
    if (parsedSections.EDUCATION && parsedSections.EDUCATION.length > 0) {
        education = parsedSections.EDUCATION.join('\n').trim();
    }

    const parsedData = {
      name: name || null,
      email: emails.length > 0 ? emails[0] : null,
      phone: phone || null,
      skills: extractedSkills,
      experience: experience,
      education: education,
      rawText: fullText,
    };

    console.log('Parsed CV Data:', parsedData);
    res.send({ parsedData });
  } catch (error) {
    console.error('Error parsing PDF in backend (pdfjs-dist):', error);
    const errorMessage = error.message || 'An unknown error occurred while parsing the PDF';
    
    let statusCode = 500;
    if (errorMessage.includes('Invalid PDF') || errorMessage.includes('corrupted')) {
      statusCode = 400;
    }
    
    res.status(statusCode).json({ 
      error: 'Error parsing PDF',
      message: errorMessage 
    });
  }
}, (error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ 
        error: 'File too large',
        message: 'File size exceeds maximum allowed size of 10MB'
      });
    }
    return res.status(400).json({ 
      error: 'File upload error',
      message: error.message 
    });
  }
  if (error) {
    return res.status(400).json({ 
      error: 'File validation error',
      message: error.message 
    });
  }
  next();
});

const buildPrompt = (parsedData) => {
  const { name, email, phone, skills, experience, education, rawText } = parsedData;
  const limitedText = rawText.substring(0, 8000);
  const limitedExperience = experience ? experience.substring(0, 2000) : 'Not found';
  const limitedEducation = education ? education.substring(0, 1000) : 'Not found';
  
  return `You are an expert career coach and CV reviewer. Analyze the following CV content and return ONLY valid JSON (no markdown, no code blocks, no explanations) that matches this exact structure:

{
  "summary": "Brief 2-3 sentence summary of the CV analysis",
  "missingSections": ["section1", "section2"],
  "suggestions": ["suggestion1", "suggestion2", "suggestion3"],
  "scoring": {
    "structure": { "score": 75, "reason": "reason text" },
    "language": { "score": 80, "reason": "reason text" },
    "relevance": { "score": 70, "reason": "reason text" },
    "technical": { "score": 75, "reason": "reason text" },
    "clarity": { "score": 80, "reason": "reason text" }
  },
  "interviewQuestions": {
    "technical": ["question1", "question2", "question3", "question4", "question5", "question6", "question7"],
    "behavioral": ["question1", "question2", "question3", "question4", "question5", "question6", "question7"],
    "roleSpecific": ["question1", "question2", "question3", "question4", "question5", "question6", "question7"]
  }
}

CRITICAL: Return ONLY the JSON object. No markdown, no code blocks, no text before or after.

Guidelines:
- Scores are 0-100 integers
- Generate 5-7 questions per category
- Make questions specific to this candidate's background
- Base analysis on the actual CV content provided

Candidate Info:
Name: ${name || 'Not found'}
Email: ${email || 'Not found'}
Phone: ${phone || 'Not found'}
Skills: ${skills && skills.length ? skills.join(', ') : 'Not found'}
Experience: ${limitedExperience}
Education: ${limitedEducation}

CV Content:
${limitedText}`;
};

const mockAnalysis = () => ({
  summary: 'Basic check: PDF successfully read, returning sample analysis.',
  missingSections: ['Projects', 'Certifications'],
  suggestions: [
    'Add measurable outcomes in Experience sections (e.g., 25% performance increase).',
    'List technical skills with proficiency levels (Beginner/Intermediate/Advanced).',
    'Add dates and degree information to the Education section.'
  ],
  scoring: {
    structure: { score: 72, reason: 'Headers are present, but format consistency can be improved.' },
    language: { score: 78, reason: 'Language is clear, some sentences can be simplified.' },
    relevance: { score: 75, reason: 'Relevance to target role is moderate; projects should be added.' },
    technical: { score: 70, reason: 'Basic skills are present, details for technologies are missing.' },
    clarity: { score: 80, reason: 'Information is readable, bullet points are sufficient.' }
  },
  interviewQuestions: {
    technical: [
      'How did you implement React performance optimizations in your recent projects?',
      'What is your strategy for error handling and logging in Node.js API design?',
      'Can you explain your approach to database optimization and query performance?',
      'How do you handle state management in large-scale applications?',
      'What testing strategies do you use to ensure code quality?',
      'How do you approach API design and RESTful principles?',
      'Can you describe your experience with version control and Git workflows?'
    ],
    behavioral: [
      'How did you work with your team under a challenging deadline?',
      'Can you give an example of when you caught and fixed an error early?',
      'Describe a situation where you had to learn a new technology quickly.',
      'Tell me about a time when you had to explain a complex technical concept to a non-technical person.',
      'How do you handle conflicting priorities when working on multiple projects?',
      'Can you share an example of how you improved a process or workflow?',
      'Describe a challenging project and how you overcame obstacles.'
    ],
    roleSpecific: [
      'How would you set up a CI/CD process suitable for this position?',
      'What patterns do you prefer for scalable frontend architecture?',
      'How would you approach code reviews and maintain code quality standards?',
      'What is your strategy for handling production incidents and debugging?',
      'How do you stay updated with the latest technologies and industry trends?',
      'Can you describe your approach to working with cross-functional teams?',
      'What methodologies do you follow for project planning and delivery?'
    ]
  }
});

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
console.log('🔑 GEMINI_API_KEY check:', GEMINI_API_KEY ? `✅ Found (${GEMINI_API_KEY.substring(0, 10)}...)` : '❌ Not found');
const genAI = GEMINI_API_KEY ? new GoogleGenerativeAI(GEMINI_API_KEY) : null;

app.get('/test-models', async (req, res) => {
  if (!genAI) {
    return res.json({ error: 'GEMINI_API_KEY not set' });
  }
  try {
    const model = genAI.getGenerativeModel();
    return res.json({ 
      message: 'API initialized successfully',
      suggestion: 'Try using model without name parameter'
    });
  } catch (error) {
    return res.status(500).json({ 
      error: 'Failed to initialize API',
      message: error.message 
    });
  }
});

app.post('/analyze-cv', async (req, res) => {
  try {
    const parsedData = req.body?.parsedData;
    if (!parsedData || !parsedData.rawText) {
      return res.status(400).json({ error: 'parsedData with rawText is required' });
    }

    if (!genAI) {
      console.warn('⚠️ GEMINI_API_KEY not set. Returning mock analysis.');
      console.warn('To use real AI analysis, set GEMINI_API_KEY in .env file');
      return res.json({ analysis: mockAnalysis(), source: 'mock' });
    }

    console.log('✅ Gemini API initialized, attempting to analyze CV...');

    const modelNames = ['gemini-2.5-flash', 'gemini-1.5-flash', 'gemini-pro'];
    let text = null;
    let lastError = null;
    
    for (const modelName of modelNames) {
      try {
        console.log(`🔄 Attempting to use model: ${modelName}`);
        const model = genAI.getGenerativeModel({ model: modelName });
        const prompt = buildPrompt(parsedData);
        console.log('📤 Sending request to Gemini API...');
        const result = await model.generateContent(prompt);
        text = result.response.text();
        console.log(`✅ Successfully used model: ${modelName}`);
        console.log('📊 Gemini response length:', text.length, 'characters');
        break;
      } catch (err) {
        lastError = err;
        console.warn(`❌ Model ${modelName} failed:`, err.message);
        if (err.status) {
          console.warn(`   HTTP Status:`, err.status);
        }
        if (err.statusText) {
          console.warn(`   Status Text:`, err.statusText);
        }
        if (err.stack) {
          console.warn(`   Stack (first 300 chars):`, err.stack.substring(0, 300));
        }
        continue;
      }
    }
    
    
    if (!text) {
      console.error('❌ All Gemini models failed, using mock analysis.');
      console.error('Last error message:', lastError?.message);
      console.error('Last error status:', lastError?.status);
      if (lastError) {
        console.error('Last error full:', JSON.stringify(lastError, Object.getOwnPropertyNames(lastError), 2));
      }
      return res.json({ 
        analysis: mockAnalysis(), 
        source: 'fallback-mock',
        error: lastError?.message || 'Unknown error',
        debug: {
          apiKeySet: !!GEMINI_API_KEY,
          apiKeyLength: GEMINI_API_KEY?.length || 0,
          modelsTried: modelNames
        }
      });
    }

    let parsed;
    try {
      parsed = JSON.parse(text);
      console.log('✅ Successfully parsed Gemini response');
      console.log('Analysis summary:', parsed.summary?.substring(0, 100));
      return res.json({ analysis: parsed, source: 'gemini' });
    } catch (err) {
      console.error('❌ Failed to parse Gemini response, returning mock.', err);
      console.error('Raw response:', text?.substring(0, 500));
      return res.json({ analysis: mockAnalysis(), source: 'fallback-parse' });
    }
  } catch (error) {
    console.error('Error during AI analysis:', error);
    return res.json({ analysis: mockAnalysis(), source: 'error-fallback' });
  }
});

app.listen(port, () => {
  console.log(`Backend server running on http://localhost:${port}`);
});
