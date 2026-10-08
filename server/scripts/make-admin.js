// Promote an existing account to admin, or create a new admin account.
// Usage: npm run make-admin -- someone@example.com [password] [Full Name]
import bcrypt from 'bcryptjs';
import { one, run } from '../src/db.js';

const [email, password, ...nameParts] = process.argv.slice(2);
if (!email) {
  console.error('Usage: npm run make-admin -- <email> [password] [full name]');
  process.exit(1);
}
const user = one('SELECT * FROM users WHERE email = ?', email.toLowerCase());
if (user) {
  run(`UPDATE users SET role = 'admin', status = 'active' WHERE id = ?`, user.id);
  if (password) run('UPDATE users SET password_hash = ? WHERE id = ?', bcrypt.hashSync(password, 10), user.id);
  console.log(`${email} is now an admin.`);
} else {
  if (!password || password.length < 8) {
    console.error('No account with that email. Pass a password (8+ characters) to create one.');
    process.exit(1);
  }
  run(`INSERT INTO users (name, email, password_hash, role, status) VALUES (?, ?, ?, 'admin', 'active')`,
    nameParts.join(' ') || 'Admin', email.toLowerCase(), bcrypt.hashSync(password, 10));
  console.log(`Created admin account ${email}.`);
}
