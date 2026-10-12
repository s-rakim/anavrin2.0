// SQLite stores UTC timestamps as "YYYY-MM-DD HH:MM:SS".
export const parseDate = (s) => (s ? new Date(s.includes('T') ? s : `${s.replace(' ', 'T')}Z`) : null);
export const sqliteNow = () => new Date().toISOString().replace('T', ' ').slice(0, 19);
