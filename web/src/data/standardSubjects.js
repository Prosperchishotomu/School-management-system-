export const STANDARD_SUBJECTS = [
  // Core Languages
  { name: 'English Language', department: 'Languages & Literature', level: 'all' },
  { name: 'Literature in English', department: 'Languages & Literature', level: 'secondary' },
  { name: 'Shona', department: 'African Languages', level: 'all' },
  { name: 'Ndebele', department: 'African Languages', level: 'all' },
  { name: 'Indigenous Languages', department: 'African Languages', level: 'primary' },
  { name: 'French', department: 'Foreign Languages', level: 'secondary' },

  // Mathematics
  { name: 'Mathematics', department: 'Mathematics', level: 'all' },
  { name: 'Pure Mathematics', department: 'Mathematics', level: 'a_level' },
  { name: 'Statistics', department: 'Mathematics', level: 'a_level' },
  { name: 'Further Mathematics', department: 'Mathematics', level: 'a_level' },

  // Natural Sciences
  { name: 'Combined Science', department: 'Natural Sciences', level: 'o_level' },
  { name: 'Biology', department: 'Natural Sciences', level: 'all' },
  { name: 'Chemistry', department: 'Natural Sciences', level: 'all' },
  { name: 'Physics', department: 'Natural Sciences', level: 'all' },
  { name: 'General Science', department: 'Natural Sciences', level: 'primary' },
  { name: 'Agriculture, Science & Technology', department: 'Natural Sciences', level: 'primary' },

  // Humanities & Social Sciences
  { name: 'Heritage Studies', department: 'Humanities & Social Sciences', level: 'all' },
  { name: 'Geography', department: 'Humanities & Social Sciences', level: 'all' },
  { name: 'History', department: 'Humanities & Social Sciences', level: 'all' },
  { name: 'Family & Religious Studies (FRS)', department: 'Humanities & Social Sciences', level: 'all' },
  { name: 'Sociology', department: 'Humanities & Social Sciences', level: 'a_level' },
  { name: 'Social Sciences', department: 'Humanities & Social Sciences', level: 'primary' },

  // Commercials & Business
  { name: 'Commerce', department: 'Commercials', level: 'o_level' },
  { name: 'Principles of Accounting', department: 'Commercials', level: 'all' },
  { name: 'Business Studies', department: 'Commercials', level: 'all' },
  { name: 'Economics', department: 'Commercials', level: 'a_level' },
  { name: 'Business Enterprise', department: 'Commercials', level: 'secondary' },

  // Technical & Computer Science
  { name: 'Computer Science / ICT', department: 'Technical & ICT', level: 'all' },
  { name: 'Information & Communication Technology', department: 'Technical & ICT', level: 'all' },
  { name: 'Agriculture', department: 'Agriculture & Environmental', level: 'all' },
  { name: 'Crop Science', department: 'Agriculture & Environmental', level: 'a_level' },
  { name: 'Animal Science', department: 'Agriculture & Environmental', level: 'a_level' },
  { name: 'Building Studies & Technology', department: 'Technical Studies', level: 'secondary' },
  { name: 'Metal Technology & Design', department: 'Technical Studies', level: 'secondary' },
  { name: 'Wood Technology & Design', department: 'Technical Studies', level: 'secondary' },
  { name: 'Technical Graphics & Design', department: 'Technical Studies', level: 'secondary' },

  // Vocational & Home Economics
  { name: 'Food & Nutrition', department: 'Vocational & Home Economics', level: 'all' },
  { name: 'Textile & Design', department: 'Vocational & Home Economics', level: 'all' },
  { name: 'Home Management', department: 'Vocational & Home Economics', level: 'secondary' },

  // Creative & Performing Arts
  { name: 'Art & Design', department: 'Creative & Performing Arts', level: 'all' },
  { name: 'Musical Arts', department: 'Creative & Performing Arts', level: 'all' },
  { name: 'Theatre Arts', department: 'Creative & Performing Arts', level: 'all' },
  { name: 'Visual & Performing Arts', department: 'Creative & Performing Arts', level: 'primary' },

  // Sports & Physical Education
  { name: 'Physical Education & Sport', department: 'Sports & Physical Education', level: 'all' },
  { name: 'Sports Management', department: 'Sports & Physical Education', level: 'a_level' },

  // Primary Broad / General
  { name: 'General Paper (GP)', department: 'Primary General', level: 'primary' },
  { name: 'English (Primary)', department: 'Primary General', level: 'primary' },
  { name: 'Mathematics (Primary)', department: 'Primary General', level: 'primary' },
  { name: 'Indigenous Language (Primary)', department: 'Primary General', level: 'primary' }
];

export const STANDARD_DEPARTMENTS = [
  'Mathematics',
  'Languages & Literature',
  'African Languages',
  'Natural Sciences',
  'Humanities & Social Sciences',
  'Commercials',
  'Technical & ICT',
  'Agriculture & Environmental',
  'Technical Studies',
  'Vocational & Home Economics',
  'Creative & Performing Arts',
  'Sports & Physical Education',
  'Primary General'
];

// Note: Streams are NOT standardized or forced because many institutions do not have streams.
// Administrators input optional stream designations (or leave blank) based on their school structure.
export const STANDARD_GRADE_LEVELS = [
  'Form 1',
  'Form 2',
  'Form 3',
  'Form 4',
  'Form 5 (Lower 6)',
  'Form 6 (Upper 6)',
  'Grade 1',
  'Grade 2',
  'Grade 3',
  'Grade 4',
  'Grade 5',
  'Grade 6',
  'Grade 7',
  'ECD A',
  'ECD B'
];
