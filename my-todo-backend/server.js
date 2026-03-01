require('dotenv').config(); 
const express = require('express');
const cors = require('cors');
const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { Resend } = require('resend'); // ✨ เปลี่ยนเป็น Resend

const app = express();
const resend = new Resend(process.env.RESEND_API_KEY); // ✨ Initialize Resend
const frontendUrl = process.env.FRONTEND_URL || 'https://my-todo-app-ochre.vercel.app';

// --- CORS Configuration ---
app.use(cors({
  origin: function (origin, callback) {
    const allowedOrigins = [
      'https://my-todo-app-ochre.vercel.app', 
      'http://localhost:5173',               
      'http://localhost:3000'
    ];
    if (!origin || allowedOrigins.includes(origin) || origin.endsWith('.vercel.app')) {
      callback(null, true);
    } else {
      callback(new Error('CORS blocked: Domain not allowed'));
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

// ✨ Reset Password Route (Resend API Version)
app.post('/api/forgot-password', async (req, res) => {
  console.log("📨 คำขอรีเซ็ตรหัสผ่าน:", req.body.email);
  try {
    const { email } = req.body;
    const [users] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
    
    if (users.length > 0) {
      const { data, error } = await resend.emails.send({
        from: 'TodoApp <onboarding@resend.dev>', // ✨ ใช้เมลนี้สำหรับ Free Tier
        to: email,
        subject: 'Reset Password - My ToDo App',
        html: `<p>คุณได้รับคำขอเปลี่ยนรหัสผ่าน คลิกที่ลิงก์ด้านล่างเพื่อตั้งรหัสใหม่:</p>
               <a href="${frontendUrl}/reset-password?email=${email}">เปลี่ยนรหัสผ่านที่นี่</a>`
      });

      if (error) {
        console.error("❌ Resend Error:", error);
        return res.status(500).json({ error: "ส่งเมลไม่สำเร็จผ่าน API" });
      }
      console.log("🚀 ส่งเมลสำเร็จ ID:", data.id);
    }
    res.json({ message: "หากมีอีเมลนี้ในระบบ เราได้ส่งลิงก์ไปให้แล้วครับ" });
  } catch (error) { 
    console.error("❌ Backend Error:", error.message);
    res.status(500).json({ error: "ระบบขัดข้องในการส่งเมล" }); 
  }
});

app.put('/api/reset-password', async (req, res) => {
  try {
    const { email, newPassword } = req.body;
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await pool.query('UPDATE users SET password_hash = ? WHERE email = ?', [hashedPassword, email]);
    res.json({ message: "เปลี่ยนรหัสผ่านสำเร็จ" });
  } catch (error) { res.status(500).json({ error: "เกิดข้อผิดพลาด" }); }
});

app.get('/api/tasks', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const query = `
      SELECT t.*, c.name as category, u_owner.username as ownerName,
      DATE_FORMAT(t.due_date, '%Y-%m-%d') as due_date,
      GROUP_CONCAT(DISTINCT u_assignee.username) as assignees_string
      FROM tasks t
      LEFT JOIN categories c ON t.category_id = c.id
      LEFT JOIN users u_owner ON t.owner_id = u_owner.id
      LEFT JOIN task_assignees ta ON t.id = ta.task_id
      LEFT JOIN users u_assignee ON ta.user_id = u_assignee.id
      WHERE t.owner_id = ? OR t.id IN (SELECT task_id FROM task_assignees WHERE user_id = ?)
      GROUP BY t.id`;
    const [rows] = await pool.query(query, [userId, userId]);
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