// Pattern backgrounds for course cards
export const cardPatterns = [
  {
    name: 'circles',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    pattern: `
      <svg width="100" height="100" xmlns="http://www.w3.org/2000/svg">
        <circle cx="20" cy="20" r="15" fill="rgba(255,255,255,0.1)" />
        <circle cx="60" cy="20" r="15" fill="rgba(255,255,255,0.1)" />
        <circle cx="20" cy="60" r="15" fill="rgba(255,255,255,0.1)" />
        <circle cx="60" cy="60" r="15" fill="rgba(255,255,255,0.1)" />
      </svg>
    `
  },
  {
    name: 'squares',
    background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
    pattern: `
      <svg width="80" height="80" xmlns="http://www.w3.org/2000/svg">
        <rect x="10" y="10" width="25" height="25" fill="rgba(255,255,255,0.15)" rx="3" />
        <rect x="45" y="10" width="25" height="25" fill="rgba(255,255,255,0.15)" rx="3" />
        <rect x="10" y="45" width="25" height="25" fill="rgba(255,255,255,0.15)" rx="3" />
        <rect x="45" y="45" width="25" height="25" fill="rgba(255,255,255,0.15)" rx="3" />
      </svg>
    `
  },
  {
    name: 'diamonds',
    background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
    pattern: `
      <svg width="100" height="100" xmlns="http://www.w3.org/2000/svg">
        <rect x="35" y="15" width="20" height="20" fill="rgba(255,255,255,0.15)" transform="rotate(45 45 25)" />
        <rect x="75" y="15" width="20" height="20" fill="rgba(255,255,255,0.15)" transform="rotate(45 85 25)" />
        <rect x="35" y="55" width="20" height="20" fill="rgba(255,255,255,0.15)" transform="rotate(45 45 65)" />
        <rect x="75" y="55" width="20" height="20" fill="rgba(255,255,255,0.15)" transform="rotate(45 85 65)" />
      </svg>
    `
  },
  {
    name: 'waves',
    background: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
    pattern: `
      <svg width="100" height="50" xmlns="http://www.w3.org/2000/svg">
        <path d="M0 25 Q 25 15, 50 25 T 100 25" stroke="rgba(255,255,255,0.2)" fill="none" stroke-width="3" />
        <path d="M0 35 Q 25 25, 50 35 T 100 35" stroke="rgba(255,255,255,0.2)" fill="none" stroke-width="3" />
      </svg>
    `
  },
  {
    name: 'dots',
    background: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
    pattern: `
      <svg width="60" height="60" xmlns="http://www.w3.org/2000/svg">
        <circle cx="15" cy="15" r="3" fill="rgba(255,255,255,0.3)" />
        <circle cx="45" cy="15" r="3" fill="rgba(255,255,255,0.3)" />
        <circle cx="15" cy="45" r="3" fill="rgba(255,255,255,0.3)" />
        <circle cx="45" cy="45" r="3" fill="rgba(255,255,255,0.3)" />
        <circle cx="30" cy="30" r="3" fill="rgba(255,255,255,0.3)" />
      </svg>
    `
  },
  {
    name: 'grid',
    background: 'linear-gradient(135deg, #30cfd0 0%, #330867 100%)',
    pattern: `
      <svg width="80" height="80" xmlns="http://www.w3.org/2000/svg">
        <line x1="0" y1="20" x2="80" y2="20" stroke="rgba(255,255,255,0.15)" stroke-width="1" />
        <line x1="0" y1="40" x2="80" y2="40" stroke="rgba(255,255,255,0.15)" stroke-width="1" />
        <line x1="0" y1="60" x2="80" y2="60" stroke="rgba(255,255,255,0.15)" stroke-width="1" />
        <line x1="20" y1="0" x2="20" y2="80" stroke="rgba(255,255,255,0.15)" stroke-width="1" />
        <line x1="40" y1="0" x2="40" y2="80" stroke="rgba(255,255,255,0.15)" stroke-width="1" />
        <line x1="60" y1="0" x2="60" y2="80" stroke="rgba(255,255,255,0.15)" stroke-width="1" />
      </svg>
    `
  }
];

export const getRandomPattern = () => {
  return cardPatterns[Math.floor(Math.random() * cardPatterns.length)];
};

export const getPatternByIndex = (index) => {
  return cardPatterns[index % cardPatterns.length];
};
