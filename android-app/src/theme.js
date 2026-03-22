export const LIGHT_COLORS = {
  primary: '#6c63ff',
  primaryLight: '#eeecff',
  background: '#FBF7EE',      // warm cream — notebook paper
  surface: '#FFFDF7',         // slightly off-white leaf
  text: '#2A2418',            // warm dark ink
  textSecondary: '#8c8275',   // warm faded ink
  border: '#E0D9C8',          // paper edge
  notebookLine: '#D8EAF8',    // light-blue ruled lines
  notebookMargin: '#F0C0C0',  // red margin line
  accent: '#F0C35A',          // golden accent (bulb, quote)
};

export const DARK_COLORS = {
  primary: '#7c74ff',
  primaryLight: '#252347',
  background: '#1A1813',      // warm dark — aged paper in dim light
  surface: '#23211A',         // slightly lighter warm dark
  text: '#EDE9D8',            // warm cream text
  textSecondary: '#7A7570',   // warm muted
  border: '#352E20',          // warm dark border
  notebookLine: '#2A3545',    // dark blue lines
  notebookMargin: '#3A2020',  // dark red margin
  accent: '#C9962A',          // dark-mode golden accent
};

// Default light export (used in places that haven't migrated to context yet)
export const COLORS = LIGHT_COLORS;
