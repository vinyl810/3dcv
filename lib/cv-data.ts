// Structured CV content for Daewon Kim, organized to mirror a standard
// (research-style) CV. Each `station` is one CV section and maps to a clickable
// 3D landmark (see lib/three/models.ts). Sections with many items use `groups`
// to split into clearly-labelled sub-sections.

export interface CVEntry {
  title?: string;
  subtitle?: string;
  period?: string;
  location?: string;
  bullets?: string[];
  tags?: string[];
  link?: { label: string; href: string };
}

export interface EntryGroup {
  heading: string;
  entries: CVEntry[];
}

export interface Station {
  /** stable id, matches the 3D object's userData.stationId */
  id: string;
  /** short label shown on hover tooltip / dot-nav */
  label: string;
  /** section eyebrow shown in the panel */
  eyebrow: string;
  /** panel heading */
  heading: string;
  /** optional one-line intro */
  intro?: string;
  /** flat entries (simple sections) */
  entries?: CVEntry[];
  /** grouped sub-sections (large sections like Projects / Coursework) */
  groups?: EntryGroup[];
}

export const profile = {
  name: 'Daewon Kim',
  hangul: '김대원',
  title: 'HCI / Cognitive-AI Researcher · Web Graphics Engineer',
  phone: '+82 10-5122-3389',
  email: 'daewon.kim@kaist.ac.kr',
  github: 'https://github.com/vinyl810',
  githubHandle: 'vinyl810',
  tagline:
    'I study how people perceive, feel, and think — and build real-time graphics on the web to explore it. Somewhere between cognitive science, HCI, generative AI, and WebGL.',
};

export const stations: Station[] = [
  {
    id: 'about',
    label: 'About',
    eyebrow: 'Hello, world',
    heading: 'Daewon Kim',
    intro: profile.tagline,
    entries: [
      {
        title: 'HCI / Cognitive-AI Researcher & Web Graphics Engineer',
        subtitle: 'KAIST GSCT · Visual Cognition Lab (Prof. Jeongmi Lee)',
        bullets: [
          'M.S. student in Culture Technology, researching at the intersection of human–computer interaction, cognitive science, and AI.',
          'Background in computer science, bio & brain engineering, and artificial intelligence.',
          '3+ years shipping production WebGL / 2D & 3D GIS web applications for Korean government agencies.',
        ],
        tags: [
          'HCI',
          'Cognitive Science',
          'Generative AI',
          'WebGL',
          'Three.js',
          'Shaders',
        ],
      },
      {
        title: 'Contact',
        bullets: [profile.phone, profile.email],
        link: { label: 'github.com/vinyl810', href: profile.github },
      },
    ],
  },
  {
    id: 'education',
    label: 'Education',
    eyebrow: 'Education',
    heading: 'Education',
    entries: [
      {
        title: 'KAIST — M.S., Culture Technology',
        subtitle: 'Visual Cognition Lab (advised by Prof. Jeongmi Lee)',
        period: '2025.09 – Present',
        location: 'Daejeon, Republic of Korea',
        tags: ['Culture Technology', 'Visual Cognition'],
      },
      {
        title: 'KAIST — B.S., Computer Science',
        subtitle:
          'Double Major: Bio & Brain Engineering · Semiminor: Artificial Intelligence',
        period: '2018.02 – 2025.08',
        location: 'Daejeon, Republic of Korea',
        tags: ['Computer Science', 'Bio & Brain Eng.', 'AI'],
      },
      {
        title: 'Chungnam Science High School',
        period: '2016.03 – 2018.02',
        location: 'Gongju, Republic of Korea',
        bullets: ['Early graduation in 2018'],
      },
    ],
  },
  {
    id: 'publications',
    label: 'Publications',
    eyebrow: 'Publications',
    heading: 'Publications',
    entries: [
      {
        title:
          'The Influence of Album Arts on the Perception of Musical Emotion',
        subtitle: 'Song, T., Min, S., Kim, D., Won, S., Go, G., Cho, S. (2026)',
        bullets: [
          'Poster — Annual Conference of the Korean Society for Cognitive and Biological Psychology, Republic of Korea.',
        ],
        tags: ['Music', 'Emotion', 'Perception'],
      },
      {
        title:
          'Adaptive Tarot Cards: A Generative AI-based Personalized Symbolic System Evolving Over Time',
        subtitle: 'Kim, D., Min, S., Lee, K., Choi, Y. (2026) — equal contribution',
        bullets: ['Creative Award, HCI Korea 2026, Hongcheon, Republic of Korea.'],
        tags: ['Generative AI', 'HCI', 'Symbolic Systems'],
      },
    ],
  },
  {
    id: 'work',
    label: 'Work · KOAST',
    eyebrow: 'Work Experience',
    heading: 'Work Experience',
    intro:
      'Industry experience building oceanic & atmospheric web graphics for Korean government agencies.',
    entries: [
      {
        title: 'Web Graphic & Frontend Engineer',
        subtitle: 'KOAST Inc., Seoul, Republic of Korea',
        period: '2023.01 – 2025.02',
        bullets: [
          'Served as an industrial technological agent for the Korean Military.',
          'Developed an oceanic digital-twin web application for government agencies.',
          'Built 2D & 3D GIS web applications for the Korea Meteorological Administration, Korea Coast Guard, and more.',
          'Developed oceanic and atmospheric single-page web applications.',
        ],
        tags: [
          'WebGL & Shaders',
          'CesiumJS',
          'OpenLayers',
          'React',
          'Vue',
          'Flutter',
        ],
      },
    ],
  },
  {
    id: 'projects',
    label: 'Projects',
    eyebrow: 'Project Experiences',
    heading: 'Projects',
    intro:
      'A spread of work across HCI/AI research, neuroscience, computer vision, web graphics & GIS, and frontend.',
    groups: [
      {
        heading: 'HCI & AI Research',
        entries: [
          {
            title: 'Safe Sustained Disagreement',
            subtitle:
              'KAIST GCT79900 · Cognitive reframing by spectating an extreme-emotion persona debate',
            period: '2026.03 – 07',
            bullets: [
              'Built a system that reframes everyday concerns by letting users spectate a non-convergent debate between emotionally extreme agent personas.',
              'Performed SFT & WDPO on Gemma-4, synthesized chat samples, and engineered safety gates so personas stay safe and avoid hopelessness.',
              'Ran a user study with 23 participants; led project design, system architecture, study design, and final analysis.',
            ],
            tags: ['LLM', 'Gemma-4', 'SFT / DPO', 'User Study', 'Safety'],
          },
        ],
      },
      {
        heading: 'Neuroscience & Vision',
        entries: [
          {
            title: 'Neural Dynamics of Alpha Power During Simulated Driving',
            subtitle: 'KAIST BiS427 · EEG / neuro-ergonomics',
            period: '2025.05 – 07',
            bullets: [
              'EEG analysis of sustained attention and fatigue during simulated driving, comparing prolonged vs. shorter driving.',
              'Showed prolonged driving induces declining alpha power, higher entropy, reduced synchrony, and unstable neural states.',
              'Built the pipeline: alpha-band (8–13 Hz) filtering, PCA & t-SNE, sliding-window correlation.',
            ],
            tags: ['EEG', 'SciPy', 'scikit-learn', 'PCA / t-SNE'],
          },
          {
            title: 'Duplicating PatchCore',
            subtitle: 'KAIST CS470 · Computer vision anomaly detection',
            period: '2022.03 – 06',
            bullets: [
              'Reproduced the PatchCore paper and tested whether background-anomaly-removal preprocessing improves its metrics.',
              'Implemented in PyTorch with scikit-learn and SciPy.',
            ],
            tags: ['PyTorch', 'Anomaly Detection', 'scikit-learn'],
          },
        ],
      },
      {
        heading: 'Web Graphics & GIS — KOAST',
        entries: [
          {
            title: 'Oceanic Digital Twin',
            subtitle: 'A 3D GIS web app modeling the ocean as a living digital twin',
            period: '2024.04 – 2025.02',
            bullets: [
              'Engineered 3D WebGL GIS layers for wave height, water temperature, and chlorophyll density; built the main 3D framework and menus.',
            ],
            tags: ['CesiumJS', 'WebGL', 'React'],
          },
          {
            title: 'KMA Oceanic Web System',
            subtitle: 'Two GIS web apps (public + expert) for the Korea Meteorological Administration',
            period: '2023.03 – 2024.10',
            bullets: [
              'Engineered 2D GIS layers for typhoons, heat index, gusts, and rip currents; built the main page, submenus, and features.',
            ],
            tags: ['OpenLayers', 'WebGL', 'Vue'],
          },
          {
            title: 'Tideland Navigation App',
            subtitle: 'A mobile app for finding safe spots between tides',
            period: '2024.04 – 2025.02',
            bullets: [
              'Engineered 2D GIS terrain layers marking danger/safe spots; built the Flutter boilerplate and the React WebView.',
            ],
            tags: ['OpenLayers', 'React', 'Flutter'],
          },
          {
            title: 'Korea Coast Guard AI Search & Rescue',
            subtitle: 'AI-assisted maritime SAR GIS web app',
            period: '2023.12 – 2024.08',
            bullets: [
              'Engineered 3D WebGL GIS layers for wind, ocean currents, and salinity.',
            ],
            tags: ['WebGL', 'OpenLayers'],
          },
          {
            title: 'KMA Atmospheric Observation Device Control',
            subtitle: 'A control/monitoring app for atmospheric-science researchers',
            period: '2024.01 – 2024.08',
            bullets: [
              'Built the project boilerplate and reviewed code for handling and monitoring observation devices.',
            ],
            tags: ['OpenLayers', 'React'],
          },
          {
            title: 'Smart Fish Farm',
            subtitle: 'A management app for fish-farm administrators',
            period: '2023.04 – 2024.03',
            bullets: [
              'Built the main page, fish-tank visualizations, SVG graphs, and CCTV screens.',
            ],
            tags: ['React', 'Vue'],
          },
        ],
      },
      {
        heading: 'Early & Course Projects',
        entries: [
          {
            title: 'Music Education Web Application',
            subtitle: 'KAIST CS374 · For novice music-sheet readers',
            period: '2021.03 – 06',
            bullets: ['Built an interactive music sheet and player.'],
            tags: ['React'],
          },
          {
            title: 'Analyzing Interest for Celebrities Using Internet News',
            subtitle: 'KAIST CS492 · NLP / clustering',
            period: '2020.03 – 06',
            bullets: [
              'Analyzed news + comments to gauge public interest/emotion, producing per-celebrity word clouds via k-means.',
            ],
            tags: ['PyTorch', 'R', 'k-means'],
          },
        ],
      },
    ],
  },
  {
    id: 'coursework',
    label: 'Coursework',
    eyebrow: 'Related Coursework',
    heading: 'Coursework',
    intro: 'Selected coursework across my majors.',
    groups: [
      {
        heading: 'Culture Technology',
        entries: [
          {
            tags: [
              'Introduction to Culture Technology',
              'Cognition and Emotion',
              'Human Visual Cognition',
              'Digital Architecture',
              'NLP for Culture Technology',
              'Computer Graphics for Culture Technology',
            ],
          },
        ],
      },
      {
        heading: 'Computer Science',
        entries: [
          {
            tags: [
              'Introduction to Algorithms',
              'Machine Learning',
              'Introduction to AI',
              'Machine Learning for 3D Data',
              'Programming for AI',
              'NLP with Python',
              'Introduction to HCI',
              'Introduction to Database',
              'Discrete Mathematics',
              'Programming Principles',
              'Introduction to R for Data Science',
              'Calculus',
            ],
          },
        ],
      },
      {
        heading: 'Bioengineering',
        entries: [
          {
            tags: [
              'Computational Neuroscience',
              'Brain Science Fundamentals',
              'Bio-Information Processing',
              'Bio-Data Structures',
              'Molecular and Cellular Biology',
              'Anatomy and Physiology',
              'Bioengineering Fundamentals',
            ],
          },
        ],
      },
    ],
  },
  {
    id: 'awards',
    label: 'Awards & Honors',
    eyebrow: 'Rewards & Honors',
    heading: 'Awards & Honors',
    entries: [
      {
        title: 'New Challenge Award — Creative Award Track, HCI Korea 2026',
        bullets: [
          'For "Adaptive Tarot Cards: A Generative AI-based Personalized Symbolic System Evolving Over Time".',
        ],
        tags: ['Creative Award', 'Generative AI'],
      },
    ],
  },
  {
    id: 'involvement',
    label: 'Involvement & Service',
    eyebrow: 'Involvement Experiences',
    heading: 'Involvement & Service',
    entries: [
      {
        title: 'Vice President — KAIST GSCT Student Council',
        period: '2026.02 – Present',
        bullets: [
          'Executes programs for the students of the Graduate School of Culture Technology.',
        ],
      },
      {
        title: 'Teaching Assistant — KAIST GSCT DaVinci Lab',
        period: '2026.03 – 06',
        bullets: ['Mentored and advised first-year GSCT graduate students.'],
      },
      {
        title: 'Mentor / Head Mentor — Korea National Science Museum STEAM Camp',
        period: '2021, 2022',
        bullets: [
          'Mentored elementary & middle-school students; as head mentor (2022) organized courses, mentors, and administration.',
        ],
      },
    ],
  },
];

export const stationById = (id: string): Station | undefined =>
  stations.find((s) => s.id === id);
