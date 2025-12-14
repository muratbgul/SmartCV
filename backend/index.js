
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
  
  // Handle multer errors
  if (req.fileValidationError) {
    return res.status(400).json({ error: req.fileValidationError });
  }
  
  if (!req.file) {
    console.log('No PDF file uploaded.');
    return res.status(400).json({ error: 'No PDF file uploaded.' });
  }

  // Additional file size check
  const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
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

    // 1. En üst kısımlarda, büyük harflerle yazılmış, 2-4 kelimelik isimleri ara (daha agresif regex)
    const topText = fullText.substring(0, Math.min(fullText.length, 1000)); // İlk 1000 karakterde ara
    const uppercaseNameRegex = /([A-ZÇĞİÖŞÜ]{2,}(?:\s[A-ZÇĞİÖŞÜ]{2,}){1,3})/;
    const uppercaseNameMatch = topText.match(uppercaseNameRegex);

    if (uppercaseNameMatch && uppercaseNameMatch[1]) {
        name = uppercaseNameMatch[1].trim();
    } else {
        // 2. Eğer büyük harfli isim bulunamazsa, "Name:", "Ad Soyad:" gibi anahtar kelimelerle ara
        const contextualNameRegex = /(?:name|ad[ı]?\s?soyad[ı]?|full\sname):?\s*([A-ZÇĞİÖŞÜ][a-zçğıöşü]+(?:\s[A-ZÇĞİÖŞÜ][a-zçğıöşü]+){1,3})/;
        const contextualNameMatch = topText.match(contextualNameRegex);
        if (contextualNameMatch && contextualNameMatch[1]) {
            name = contextualNameMatch[1].trim();
        } else {
             // 3. Son çare olarak compromise'dan gelen insan isimlerini dene (iki kelimeden uzun olanları tercih et)
            const possibleNames = doc.people().out('array');
            const filteredNames = possibleNames.filter(p => p.split(' ').length >= 2);
            if (filteredNames.length > 0) {
                name = filteredNames[0];
            } else if (possibleNames.length > 0) {
                name = possibleNames[0]; // Tek kelimelik isimleri de al
            }
        }
    }

    const emails = doc.emails().out('array');
    
    // Telefon numarası ayrıştırma (daha sağlam bir yöntemle)
    let phone = null;
    const nlpPhoneNumbers = doc.phoneNumbers().out('array');
    if (nlpPhoneNumbers.length > 0) {
        phone = nlpPhoneNumbers[0];
    } else {
        // Daha genel bir telefon numarası regex'i
        const phoneRegex = /(\+?\d{1,3}[-.\s]?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4})/g;
        const phoneMatch = fullText.match(phoneRegex);
        if (phoneMatch && phoneMatch.length > 0) {
            phone = phoneMatch[0];
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

    // Yeni deneyim ve eğitim ayrıştırma mantığı (satır satır işleme)
    let experience = null;
    let education = null;

    const lines = fullText.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    const parsedSections = {};
    let currentSectionKey = null; // Mevcut bölümün anahtarını tutar

    // Tüm ana bölüm başlıklarını ve bunların kanonik anahtarlarını tanımlayalım
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

    // Tüm başlıkları kapsayan regex deseni oluştur
    const headerPattern = Object.keys(sectionHeadersMap).map(h => h.replace(/ /g, '\\s*')).join('|');
    const headerRegex = new RegExp(`^(${headerPattern})$`, 'i');

    for (const line of lines) {
        const match = line.match(headerRegex);
        if (match) {
            // Yeni bir bölüm başlığı bulundu
            const matchedHeaderOriginalKey = Object.keys(sectionHeadersMap).find(key =>
                new RegExp(`^${key.replace(/ /g, '\\s*')}$`, 'i').test(match[1])
            );
            
            if (matchedHeaderOriginalKey) {
                currentSectionKey = sectionHeadersMap[matchedHeaderOriginalKey];
                if (!parsedSections[currentSectionKey]) {
                    // Deneyim ve eğitim için girişleri bir dizi olarak sakla
                    if (currentSectionKey === 'EXPERIENCE' || currentSectionKey === 'EDUCATION') {
                        parsedSections[currentSectionKey] = [];
                    } else {
                        parsedSections[currentSectionKey] = ''; // Diğer bölümler için string olarak sakla
                    }
                }
            } else {
                currentSectionKey = null; // Geçersiz başlık, sıfırla
            }
        } else if (currentSectionKey) {
            // Bölüm içindeki bir satır
            if (currentSectionKey === 'EXPERIENCE' || currentSectionKey === 'EDUCATION') {
                // Yeni bir deneyim/eğitim girişi için sezgisel yaklaşım:
                // Satır, bir tarih deseniyle (örn. "Jul. 2024 - Aug. 2024") başlıyorsa
                // veya büyük harfle başlayan ve başlık gibi görünen bir kelimeyle başlıyorsa yeni bir giriş olarak kabul et.
                const isNewEntry = /^(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|Ocak|Şubat|Mart|Nisan|Mayıs|Haziran|Temmuz|Ağustos|Eylül|Ekim|Kasım|Aralık|\d{4})/.test(line) ||
                                 /^[A-ZÇĞİÖŞÜ][a-zçğıöşü0-9.,\s&-]+$/.test(line); // Büyük harfle başlıyor ve başlık gibi duruyor

                if (parsedSections[currentSectionKey].length === 0 || isNewEntry) {
                    // Yeni bir giriş başlat
                    parsedSections[currentSectionKey].push(line);
                } else {
                    // Son girişe ekle (açıklama vb. devamı olduğunu varsayarak)
                    parsedSections[currentSectionKey][parsedSections[currentSectionKey].length - 1] += '\n' + line;
                }
            } else {
                // Diğer bölümler için satırı string'e ekle
                parsedSections[currentSectionKey] += line + '\n';
            }
        }
    }

    // Ayrıştırılmış bölümlerden deneyim ve eğitimi al
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
    
    // More specific error messages
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
  // Multer error handler
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

/**
 * Build a concise prompt for Gemini with extracted CV data and raw text.
 */
const buildPrompt = (parsedData) => {
  const { name, email, phone, skills, experience, education, rawText } = parsedData;
  // Limit text length to avoid token limits
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

/**
 * Fallback mock response when GEMINI_API_KEY is not provided.
 */
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

// Test endpoint to list available models
app.get('/test-models', async (req, res) => {
  if (!genAI) {
    return res.json({ error: 'GEMINI_API_KEY not set' });
  }
  try {
    // Try to list models (if API supports it)
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

    // If no API key, return mock analysis so the UI can still function.
    if (!genAI) {
      console.warn('⚠️ GEMINI_API_KEY not set. Returning mock analysis.');
      console.warn('To use real AI analysis, set GEMINI_API_KEY in .env file');
      return res.json({ analysis: mockAnalysis(), source: 'mock' });
    }

    console.log('✅ Gemini API initialized, attempting to analyze CV...');

    // Try multiple model names, fallback to mock if all fail
    // Updated model names - gemini-pro is deprecated, use gemini-1.5 models
    const modelNames = ['gemini-1.5-flash', 'gemini-1.5-pro'];
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
        break; // Success, exit loop
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
    
    // If all named models failed, try default model (no name specified)
    if (!text) {
      try {
        console.log('🔄 Trying default model (no name specified)...');
        const defaultModel = genAI.getGenerativeModel();
        const prompt = buildPrompt(parsedData);
        const result = await defaultModel.generateContent(prompt);
        text = result.response.text();
        console.log(`✅ Successfully used default model`);
        console.log('📊 Gemini response length:', text.length, 'characters');
      } catch (err) {
        console.warn('❌ Default model also failed:', err.message);
        lastError = err;
      }
    }
    
    // If all models failed, return mock analysis
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
    // Return mock instead of error, so UI still works
    return res.json({ analysis: mockAnalysis(), source: 'error-fallback' });
  }
});

app.listen(port, () => {
  console.log(`Backend server running on http://localhost:${port}`);
});
