# SmartCV - AI-Powered Resume Analyzer

SmartCV is a web application that analyzes CV/Resume PDF files using AI-powered text extraction and natural language processing. Upload your PDF resume and get instant analysis including contact information, skills, work experience, and education details.

## Features

- 📄 **PDF Upload**: 
  - Drag and drop or click to upload PDF resumes
  - File size validation (max 10MB)
  - Success notifications
  - Real-time error handling
  
- 🤖 **AI-Powered Analysis (Gemini)**:
  - Detects missing sections (Skills, Experience, Formatting, etc.)
  - Gives actionable improvement suggestions
  - Scores the CV on Structure, Language, Relevance, Technical, Clarity (0-100 scale with visual progress bars)
  - Generates Technical, Behavioral, and Role-Specific interview questions
  - Fallback to mock analysis if API key is not configured
  
- 🧠 **Smart Extraction**: 
  - Name, email, phone number detection
  - 50+ technical skills recognition
  - Experience and education section parsing
  - Collapsible raw text view for performance
  
- 🎨 **Modern UI**: 
  - Next.js + Tailwind CSS
  - Responsive design (mobile-friendly)
  - Loading states and animations
  - Accessible components (ARIA labels, keyboard navigation)
  - Clean header/footer layout
  
- ⚡ **Performance**: 
  - Fast PDF parsing with pdfjs-dist
  - Optimized text extraction
  - Efficient state management

## Tech Stack

### Frontend
- **Next.js 16** - React framework
- **React 19** - UI library
- **TypeScript** - Type safety
- **Tailwind CSS 4** - Styling
- **react-dropzone** - File upload component

### Backend
- **Express.js 5** - Web server
- **pdfjs-dist** - PDF parsing
- **compromise** - Natural language processing
- **multer** - File upload handling

## Getting Started

### Prerequisites

- Node.js (v18 or higher)
- npm or yarn

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd smartcv
```

2. Install frontend dependencies:
```bash
npm install
```

3. Install backend dependencies:
```bash
cd backend
npm install
cd ..
```

4. (Optional) Configure environment variables:
   - Frontend: Create a `.env.local` file in the root directory:
   ```
   NEXT_PUBLIC_API_URL=http://localhost:5000
   ```
   - Backend: Create a `.env` file inside `backend/`:
   ```
   GEMINI_API_KEY=YOUR_API_KEY
   ```
   - Eğer API key eklemezseniz, backend mock analiz döndürür (uygulama yine çalışır).

### Running the Application

You need to run both the frontend and backend servers:

1. **Start the backend server** (in one terminal):
```bash
cd backend
npm start
```
The backend will run on `http://localhost:5000`

2. **Start the frontend development server** (in another terminal):
```bash
npm run dev
```
The frontend will run on `http://localhost:3000`

3. Open [http://localhost:3000](http://localhost:3000) in your browser

## Usage

1. Navigate to the application in your browser
2. Drag and drop a PDF resume file or click to select one
3. Wait for the processing to complete
4. View the extracted information including:
   - Contact details (name, email, phone)
   - Skills list
   - Work experience
   - Education history
   - Raw text content

## Project Structure

```
smartcv/
├── src/
│   ├── app/              # Next.js app directory
│   │   ├── layout.tsx    # Root layout
│   │   ├── page.tsx      # Home page
│   │   └── globals.css   # Global styles
│   └── components/       # React components
│       ├── Header.tsx    # Header component
│       ├── Footer.tsx    # Footer component
│       ├── PdfUpload.tsx # PDF upload component
│       └── layout/
│           └── MainLayout.tsx # Main layout wrapper
├── backend/
│   ├── index.js         # Express server
│   └── package.json     # Backend dependencies
├── public/              # Static assets
└── package.json         # Frontend dependencies
```

## API Endpoints

### POST `/upload-pdf`

Uploads and processes a PDF file.

**Request:**
- Method: POST
- Content-Type: multipart/form-data
- Body: FormData with `pdf` field containing the PDF file

**Response:**
```json
{
  "parsedData": {
    "name": "John Doe",
    "email": "john@example.com",
    "phone": "+1234567890",
    "skills": ["React", "Node.js", "TypeScript"],
    "experience": "Work experience text...",
    "education": "Education history...",
    "rawText": "Full extracted text..."
  }
}
```

## Development

### Frontend Scripts
- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm start` - Start production server
- `npm run lint` - Run ESLint

### Backend Scripts
- `npm start` - Start backend server
- `npm run dev` - Start backend server (alias)

## License

ISC

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
