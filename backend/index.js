
require('dotenv').config();
const express = require('express');
const multer = require('multer');
const cors = require('cors');
const { getDocument } = require('pdfjs-dist/legacy/build/pdf.mjs');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const nlp = require('compromise');

const app = express();
const port = 5000;

app.use(cors());
app.use(express.json());

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

app.post('/upload-pdf', upload.single('pdf'), async (req, res) => {
  console.log('Received upload-pdf request.');
  if (!req.file) {
    console.log('No PDF file uploaded.');
    return res.status(400).json({ error: 'No PDF file uploaded.' });
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

    const skillsKeywords = ['HTML', 'CSS', 'JavaScript', 'TypeScript', 'React', 'Node.js', 'Python', 'Angular', 'Next.js', 'Tailwind', 'Bootstrap'];
    const extractedSkills = skillsKeywords.filter(keyword =>
      new RegExp(`\\b${keyword}\\b`, 'i').test(fullText)
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
    res.status(500).json({ 
      error: 'Error parsing PDF',
      message: errorMessage 
    });
  }
});

/**
 * Build a concise prompt for Gemini with extracted CV data and raw text.
 */
const buildPrompt = (parsedData) => {
  const { name, email, phone, skills, experience, education, rawText } = parsedData;
  return `
You are an expert career coach and CV reviewer. Analyze the following CV content and return structured JSON that exactly matches this TypeScript type:
{
  "summary": string,
  "missingSections": string[],
  "suggestions": string[],
  "scoring": {
    "structure": { "score": number, "reason": string },
    "language": { "score": number, "reason": string },
    "relevance": { "score": number, "reason": string },
    "technical": { "score": number, "reason": string },
    "clarity": { "score": number, "reason": string }
  },
  "interviewQuestions": {
    "technical": string[],
    "behavioral": string[],
    "roleSpecific": string[]
  }
}

Guidelines:
- Scores are 0-100 integers.
- Give concise, actionable reasons and suggestions.
- Tailor questions to the candidate profile and likely target roles.

Extracted fields:
- Name: ${name || 'Not found'}
- Email: ${email || 'Not found'}
- Phone: ${phone || 'Not found'}
- Skills: ${skills && skills.length ? skills.join(', ') : 'Not found'}
- Experience: ${experience || 'Not found'}
- Education: ${education || 'Not found'}

Full CV text:
${rawText}
`;
};

/**
 * Fallback mock response when GEMINI_API_KEY is not provided.
 */
const mockAnalysis = () => ({
  summary: 'Temel kontrol: PDF başarıyla okundu, örnek analiz döndürülüyor.',
  missingSections: ['Projects', 'Certifications'],
  suggestions: [
    'Experience bölümlerinde ölçülebilir çıktılar ekleyin (örn. %25 performans artışı).',
    'Teknik becerileri seviyeleriyle listeleyin (Beginner/Intermediate/Advanced).',
    'Eğitim bölümüne tarih ve derece bilgisi ekleyin.'
  ],
  scoring: {
    structure: { score: 72, reason: 'Başlıklar mevcut, ancak format tutarlılığı iyileştirilebilir.' },
    language: { score: 78, reason: 'Dil anlaşılır, bazı cümleler sadeleştirilebilir.' },
    relevance: { score: 75, reason: 'Hedef role uygunluk orta seviyede; projeler eklenmeli.' },
    technical: { score: 70, reason: 'Temel beceriler var, teknolojiler için detay eksik.' },
    clarity: { score: 80, reason: 'Bilgiler okunabilir, madde işaretleri yeterli.' }
  },
  interviewQuestions: {
    technical: [
      'Recent projelerinde React performans optimizasyonlarını nasıl uyguladın?',
      'Node.js API tasarımında hata yönetimi ve logging stratejin nedir?'
    ],
    behavioral: [
      'Zorlayıcı bir deadline’da ekibinle nasıl çalıştın?',
      'Bir hatayı erken fark edip çözdüğün bir örnek anlatır mısın?'
    ],
    roleSpecific: [
      'Pozisyona uygun olarak CI/CD sürecini nasıl kurarsın?',
      'Ölçeklenebilir frontend mimarisi için hangi patternleri tercih edersin?'
    ]
  }
});

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
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
      console.warn('GEMINI_API_KEY not set. Returning mock analysis.');
      return res.json({ analysis: mockAnalysis(), source: 'mock' });
    }

    // Try multiple model names, fallback to mock if all fail
    const modelNames = ['gemini-pro', 'gemini-1.0-pro', 'gemini-1.5-pro'];
    let text = null;
    let lastError = null;
    
    for (const modelName of modelNames) {
      try {
        const model = genAI.getGenerativeModel({ model: modelName });
        const prompt = buildPrompt(parsedData);
        const result = await model.generateContent(prompt);
        text = result.response.text();
        console.log(`Successfully used model: ${modelName}`);
        break; // Success, exit loop
      } catch (err) {
        lastError = err;
        console.warn(`Model ${modelName} failed:`, err.message);
        continue;
      }
    }
    
    // If all models failed, return mock analysis
    if (!text) {
      console.warn('All Gemini models failed, using mock analysis. Error:', lastError?.message);
      return res.json({ analysis: mockAnalysis(), source: 'fallback-mock' });
    }

    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch (err) {
      console.error('Failed to parse Gemini response, returning mock.', err);
      return res.json({ analysis: mockAnalysis(), source: 'fallback-parse' });
    }

    return res.json({ analysis: parsed, source: 'gemini' });
  } catch (error) {
    console.error('Error during AI analysis:', error);
    // Return mock instead of error, so UI still works
    return res.json({ analysis: mockAnalysis(), source: 'error-fallback' });
  }
});

app.listen(port, () => {
  console.log(`Backend server running on http://localhost:${port}`);
});
