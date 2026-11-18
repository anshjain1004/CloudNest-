import 'dotenv/config';
import { sql } from './config/db.js';

async function test() {
    const [user] = await sql`SELECT id, email, password FROM users LIMIT 1`;
    console.log('First user:', user);
    if (user) {
        const bcrypt = await import('bcryptjs');
        const pw = await bcrypt.compare('test12345', user.password);
        console.log('Password match with test12345:', pw);
    }
}
test();
