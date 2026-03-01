require('dotenv').config(); 
const express = require('express');
const cors = require('cors');
const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { google } = require('googleapis'); // ✨ ใช้ Google APIs แทน Nodemailer

const app = express();
const frontendUrl = process.env.FRONTEND_URL || 'https://my-to-do-app-ochre.vercel.app';

// --- CORS Configuration ---
app.use(cors({
  origin: function (origin, callback) {
    const allowedOrigins = ['https://my-to-do-app-ochre.vercel.app', 'http://localhost:5173', 'http://localhost:3000'];
    if (!origin || allowedOrigins.includes(origin) || origin.endsWith('.vercel.app')) {
      callback(null, true);
    } else {
      callback(new Error('CORS blocked'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  credentials: true
}));

app.use(express.json());

// --- Database Connection ---
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  dateStrings: true, 
  port: process.env.DB_PORT || 3306 
});

const initializeDB = async () => {
  try {
    await pool.query(`CREATE TABLE IF NOT EXISTS users (id INT AUTO_INCREMENT PRIMARY KEY, username VARCHAR(255) UNIQUE NOT NULL, email VARCHAR(255) UNIQUE NOT NULL, password_hash VARCHAR(255) NOT NULL)`);
    await pool.query(`CREATE TABLE IF NOT EXISTS categories (id INT AUTO_INCREMENT PRIMARY KEY, name VARCHAR(255) NOT NULL, user_id INT, FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE)`);
    await pool.query(`CREATE TABLE IF NOT EXISTS tasks (id INT AUTO_INCREMENT PRIMARY KEY, title VARCHAR(255) NOT NULL, status VARCHAR(50) DEFAULT 'Pending', due_date DATE, category_id INT, owner_id INT, FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL, FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE)`);
    await pool.query(`CREATE TABLE IF NOT EXISTS task_assignees (task_id INT, user_id INT, PRIMARY KEY (task_id, user_id), FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE, FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE)`);
    console.log("✅ ตรวจสอบและสร้างตารางใน Database สำเร็จ!");
  } catch (error) {
    console.error("❌ เกิดข้อผิดพลาดในการสร้างตาราง:", error.message);
  }
};
initializeDB();

// --- ✨ Gmail REST API (HTTPS Port 443) ---
const oAuth2Client = new google.auth.OAuth2(
  process.env.GMAIL_CLIENT_ID,
  process.env.GMAIL_CLIENT_SECRET,
  "https://developers.google.com/oauthplayground"
);
oAuth2Client.setCredentials({ refresh_token: process.env.GMAIL_REFRESH_TOKEN });
const gmail = google.gmail({ version: 'v1', auth: oAuth2Client });

// ฟังก์ชันสร้างและส่งอีเมลผ่าน HTTP API (ไม่โดนบล็อกพอร์ต)
const sendMailViaAPI = async (to, subject, htmlContent) => {
  const utf8Subject = `=?utf-8?B?${Buffer.from(subject).toString('base64')}?=`;
  const messageParts = [
    `From: "My ToDo App" <${process.env.EMAIL_USER}>`,
    `To: ${to}`,
    'Content-Type: text/html; charset=utf-8',
    'MIME-Version: 1.0',
    `Subject: ${utf8Subject}`,
    '',
    htmlContent
  ];
  const message = messageParts.join('\n');
  
  // แปลงข้อมูลเป็น Base64 แบบ URL Safe
  const encodedMessage = Buffer.from(message)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  await gmail.users.messages.send({
    userId: 'me',
    requestBody: { raw: encodedMessage }
  });
};

const SECRET_KEY = process.env.JWT_SECRET;

// --- Auth Middleware ---
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; 
  if (!token) return res.status(401).json({ error: "กรุณาเข้าสู่ระบบก่อน" });
  jwt.verify(token, SECRET_KEY, (err, user) => {
    if (err) return res.status(403).json({ error: "Token ไม่ถูกต้องหรือหมดอายุ" });
    req.user = user;
    next();
  });
};

// --- Routes ---

app.post('/api/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);
    await pool.query('INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)', [username, email, hashedPassword]);
    res.status(201).json({ message: "สมัครสมาชิกสำเร็จ!" });
  } catch (error) { res.status(500).json({ error: "ชื่อผู้ใช้หรืออีเมลนี้มีในระบบแล้ว" }); }
});

app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const [users] = await pool.query('SELECT * FROM users WHERE username = ? OR email = ?', [username, username]);
    if (users.length === 0) return res.status(401).json({ error: "ไม่พบผู้ใช้งาน" });
    const isMatch = await bcrypt.compare(password, users[0].password_hash);
    if (!isMatch) return res.status(401).json({ error: "รหัสผ่านไม่ถูกต้อง" });
    const token = jwt.sign({ id: users[0].id, username: users[0].username }, SECRET_KEY, { expiresIn: '24h' });
    res.json({ token, user: { id: users[0].id, username: users[0].username } });
  } catch (error) { res.status(500).json({ error: "ระบบขัดข้อง" }); }
});

app.post('/api/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    const [users] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);

    if (users.length > 0) {
      const resetToken = jwt.sign(
        { email },
        SECRET_KEY,
        { expiresIn: "15m" }
      );

      const resetLink = `${frontendUrl}/reset-password?token=${resetToken}`;

      const htmlContent = `
        <div style="font-family: sans-serif; text-align: center; padding: 20px;">
          <h2>คำขอเปลี่ยนรหัสผ่าน</h2>
          <p>คลิกปุ่มด้านล่างเพื่อตั้งรหัสผ่านใหม่ (ลิงก์หมดอายุใน 15 นาที)</p>
          <a href="${resetLink}"
             style="display:inline-block;padding:10px 20px;background:#2563eb;color:white;text-decoration:none;border-radius:8px;font-weight:bold;">
             ตั้งรหัสผ่านใหม่
          </a>
        </div>
      `;

      await sendMailViaAPI(email, 'Reset Password - My ToDo App', htmlContent);
    }

    res.json({ message: "หากมีอีเมลนี้ในระบบ เราได้ส่งลิงก์ไปให้แล้วครับ" });
  } catch (error) {
    res.status(500).json({ error: "เกิดข้อผิดพลาด" });
  }
});

app.put('/api/reset-password', async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    if (!token) {
      return res.status(400).json({ error: "Missing token" });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, SECRET_KEY);
    } catch (err) {
      return res.status(400).json({ error: "Token ไม่ถูกต้องหรือหมดอายุ" });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await pool.query(
      'UPDATE users SET password_hash = ? WHERE email = ?',
      [hashedPassword, decoded.email]
    );

    res.json({ message: "เปลี่ยนรหัสผ่านสำเร็จ" });

  } catch (error) {
    res.status(500).json({ error: "เกิดข้อผิดพลาด" });
  }
});

// --- Task APIs ---
app.get('/api/tasks', authenticateToken, async (req, res) => {
  try {
    const query = `
      SELECT t.*, c.name as category, 
      u_owner.username as ownerName, 
      DATE_FORMAT(t.due_date, '%Y-%m-%d') as due_date,
      GROUP_CONCAT(DISTINCT u_assignee.username) as assignees_string
      FROM tasks t
      LEFT JOIN categories c ON t.category_id = c.id
      LEFT JOIN users u_owner ON t.owner_id = u_owner.id
      LEFT JOIN task_assignees ta ON t.id = ta.task_id
      LEFT JOIN users u_assignee ON ta.user_id = u_assignee.id
      GROUP BY t.id`;
      
    const [rows] = await pool.query(query); 
    res.json(rows.map(row => ({ 
      ...row, 
      dueDate: row.due_date, 
      assignees: row.assignees_string ? row.assignees_string.split(',') : [] 
    })));
  } catch (error) { res.status(500).json({ error: "ดึงข้อมูลล้มเหลว" }); }
});

const getOrCreateCategoryId = async (categoryName, userId) => {
  if (!categoryName) return null;
  let [cats] = await pool.query('SELECT id FROM categories WHERE name = ? AND user_id = ?', [categoryName, userId]);
  if (cats.length > 0) return cats[0].id;
  const [newCat] = await pool.query('INSERT INTO categories (name, user_id) VALUES (?, ?)', [categoryName, userId]);
  return newCat.insertId;
};

const updateAssignees = async (taskId, assignees) => {
  if (!assignees) return;
  const assigneeList = Array.isArray(assignees) ? assignees : String(assignees).split(',').map(s => s.trim()).filter(s => s !== "");
  await pool.query('DELETE FROM task_assignees WHERE task_id = ?', [taskId]);
  if (assigneeList.length > 0) {
    const [users] = await pool.query('SELECT id FROM users WHERE username IN (?)', [assigneeList]);
    if (users.length > 0) {
      const values = users.map(u => [taskId, u.id]);
      await pool.query('INSERT INTO task_assignees (task_id, user_id) VALUES ?', [values]);
    }
  }
};

app.post('/api/tasks', authenticateToken, async (req, res) => {
  try {
    const { title, category, status, dueDate, assignees } = req.body;
    const userId = req.user.id;
    const categoryId = await getOrCreateCategoryId(category, userId);
    const [result] = await pool.query('INSERT INTO tasks (title, status, due_date, owner_id, category_id) VALUES (?, ?, ?, ?, ?)', [title, status, dueDate || null, userId, categoryId]);
    await updateAssignees(result.insertId, assignees);
    res.status(201).json({ message: "เพิ่มงานสำเร็จ" });
  } catch (error) { res.status(500).json({ error: "เพิ่มงานไม่สำเร็จ: " + error.message }); }
});

app.put('/api/tasks/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { title, category, status, dueDate, assignees } = req.body;
    const userId = req.user.id;
    const categoryId = await getOrCreateCategoryId(category, userId);
    await pool.query('UPDATE tasks SET title = ?, status = ?, due_date = ?, category_id = ? WHERE id = ? AND owner_id = ?', [title, status, dueDate || null, categoryId, id, userId]);
    await updateAssignees(id, assignees);
    res.json({ message: "อัปเดตสำเร็จ" });
  } catch (error) { res.status(500).json({ error: "อัปเดตไม่สำเร็จ" }); }
});

app.delete('/api/tasks/completed', authenticateToken, async (req, res) => {
  try {
    await pool.query('DELETE FROM tasks WHERE status = ? AND owner_id = ?', ['Completed', req.user.id]);
    res.json({ message: "เคลียร์งานสำเร็จ" });
  } catch (error) { res.status(500).json({ error: "ลบไม่สำเร็จ" }); }
});

app.delete('/api/tasks/:id', authenticateToken, async (req, res) => {
  try {
    await pool.query('DELETE FROM tasks WHERE id = ? AND owner_id = ?', [req.params.id, req.user.id]);
    res.json({ message: "ลบงานสำเร็จ" });
  } catch (error) { res.status(500).json({ error: "ลบไม่สำเร็จ" }); }
});

const PORT = process.env.PORT || 8080; 
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});