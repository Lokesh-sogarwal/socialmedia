// Usage: npm run make-moderator -- <username> [moderator|admin|user]
import { connectDatabase, disconnectDatabase } from '../src/config/db.js';
import { User } from '../src/models/index.js';

const [username, role = 'moderator'] = process.argv.slice(2);
if (!username || !['moderator', 'admin', 'user'].includes(role)) {
  console.error('Usage: npm run make-moderator -- <username> [moderator|admin|user]');
  process.exit(1);
}
await connectDatabase();
const result = await User.updateOne({ username: username.toLowerCase() }, { $set: { role } });
console.log(result.matchedCount ? `@${username} is now ${role}` : `No user named @${username}`);
await disconnectDatabase();
