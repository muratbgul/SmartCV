// API Configuration
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

// File Upload Configuration
export const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
export const ACCEPTED_FILE_TYPES = ['application/pdf'];
export const ACCEPTED_FILE_EXTENSIONS = ['.pdf'];

// Skills Keywords for extraction
export const SKILLS_KEYWORDS = [
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

