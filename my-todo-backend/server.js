require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mysql = require('mysql2/promise');

// ลบไลบรารีที่เกี่ยวกับ Login และ Email ออกทั้งหมดให้โค้ดเบาที่สุด
const frontendUrl = 'https://my-to-do-app-ochre.vercel.app';

const app = express();
const PORT = process.env.PORT || 8080;

// --- CORS Configuration ---
app.use(cors({
  origin: function (origin, callback) {
    const allowedOrigins = [frontendUrl, 'http://localhost:5173', 'http://localhost:3000'];
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
  port: Number(process.env.DB_PORT) || 3306,
  dateStrings: true, 
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

const initializeDB = async () => {
  try {
    // โครงสร้างตารางยังคงเดิมไว้ เผื่ออนาคตอยากนำระบบ Login กลับมา
    await pool.query(`CREATE TABLE IF NOT EXISTS users (id INT AUTO_INCREMENT PRIMARY KEY, username VARCHAR(255) UNIQUE NOT NULL, email VARCHAR(255) UNIQUE NOT NULL, password_hash VARCHAR(255) NOT NULL)`);
    await pool.query(`CREATE TABLE IF NOT EXISTS categories (id INT AUTO_INCREMENT PRIMARY KEY, name VARCHAR(255) NOT NULL, user_id INT, FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE)`);
    await pool.query(`CREATE TABLE IF NOT EXISTS tasks (id INT AUTO_INCREMENT PRIMARY KEY, title VARCHAR(255) NOT NULL, status VARCHAR(50) DEFAULT 'Pending', due_date DATE, category_id INT, owner_id INT, FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL, FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE)`);
    await pool.query(`CREATE TABLE IF NOT EXISTS task_assignees (task_id INT, user_id INT, PRIMARY KEY (task_id, user_id), FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE, FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE)`);
    console.log("✅ Database tables are ready!");
  } catch (error) {
    console.error("❌ Database initialization failed:", error.message);
  }
};
initializeDB();

// --- Helper Functions ---
// ค้นหาหรือสร้างหมวดหมู่ใหม่ (โดยไม่ต้องผูกกับ User ID แล้ว)
const getOrCreateCategoryId = async (categoryName) => {
  if (!categoryName) return null;
  const [cats] = await pool.query('SELECT id FROM categories WHERE name = ?', [categoryName]);
  if (cats.length > 0) return cats[0].id;
  
  const [newCat] = await pool.query('INSERT INTO categories (name) VALUES (?)', [categoryName]);
  return newCat.insertId;
};

// อัปเดตผู้รับผิดชอบงาน (ถ้าพิมพ์ชื่อคนใหม่มา ระบบจะสร้างเป็น Dummy User ให้เพื่อไม่ให้ฐานข้อมูล Error)
const updateAssignees = async (taskId, assignees) => {
  if (!assignees) return;
  const assigneeList = Array.isArray(assignees) ? assignees : String(assignees).split(',').map(s => s.trim()).filter(s => s !== "");
  
  await pool.query('DELETE FROM task_assignees WHERE task_id = ?', [taskId]);
  
  if (assigneeList.length > 0) {
    let userIds = [];
    for (let name of assigneeList) {
       let [users] = await pool.query('SELECT id FROM users WHERE username = ?', [name]);
       if (users.length > 0) {
          userIds.push(users[0].id);
       } else {
          // สร้าง Dummy User อัตโนมัติเพื่อให้ผูกกับ Task ได้
          let [newUser] = await pool.query('INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)', [name, `${name}_${Date.now()}@dummy.com`, 'no_password']);
          userIds.push(newUser.insertId);
       }
    }
    
    if (userIds.length > 0) {
      const values = userIds.map(uid => [taskId, uid]);
      await pool.query('INSERT INTO task_assignees (task_id, user_id) VALUES ?', [values]);
    }
  }
};

// --- Task Routes (เปิดสาธารณะทั้งหมด) ---

app.get('/api/tasks', async (req, res) => {
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
      GROUP BY t.id
      ORDER BY t.id DESC
    `; // ลบเงื่อนไข WHERE t.owner_id ออก เพื่อให้ดึงงานได้ทั้งหมด
      
    const [rows] = await pool.query(query); 
    const tasks = rows.map(row => ({ 
      ...row, 
      dueDate: row.due_date, 
      assignees: row.assignees_string ? row.assignees_string.split(',') : [] 
    }));
    res.json(tasks);
  } catch (error) { 
    console.error("Get Tasks Error:", error.message);
    res.status(500).json({ error: "ดึงข้อมูลล้มเหลว" }); 
  }
});

app.post('/api/tasks', async (req, res) => {
  try {
    const { title, category, status, dueDate, assignees } = req.body;
    if (!title) return res.status(400).json({ error: "กรุณาระบุชื่องาน" });

    const categoryId = await getOrCreateCategoryId(category);
    
    // สร้าง Task โดยปล่อย owner_id ว่างไว้ (NULL) ได้เลย
    const [result] = await pool.query(
      'INSERT INTO tasks (title, status, due_date, category_id) VALUES (?, ?, ?, ?)', 
      [title, status || 'Pending', dueDate || null, categoryId]
    );
    
    await updateAssignees(result.insertId, assignees);
    res.status(201).json({ message: "เพิ่มงานสำเร็จ" });
  } catch (error) { 
    console.error("Create Task Error:", error.message);
    res.status(500).json({ error: "เพิ่มงานไม่สำเร็จ" }); 
  }
});

app.put('/api/tasks/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { title, category, status, dueDate, assignees } = req.body;
    
    const categoryId = await getOrCreateCategoryId(category);
    
    // อัปเดตโดยไม่ต้องเช็คว่าใครเป็นเจ้าของงาน
    await pool.query(
      'UPDATE tasks SET title = ?, status = ?, due_date = ?, category_id = ? WHERE id = ?', 
      [title, status, dueDate || null, categoryId, id]
    );
    
    await updateAssignees(id, assignees);
    res.json({ message: "อัปเดตสำเร็จ" });
  } catch (error) { 
    console.error("Update Task Error:", error.message);
    res.status(500).json({ error: "อัปเดตไม่สำเร็จ" }); 
  }
});

app.delete('/api/tasks/completed', async (req, res) => {
  try {
    await pool.query('DELETE FROM tasks WHERE status = ?', ['Completed']);
    res.json({ message: "เคลียร์งานที่เสร็จแล้วเรียบร้อย" });
  } catch (error) { 
    console.error("Delete Completed Tasks Error:", error.message);
    res.status(500).json({ error: "ลบงานไม่สำเร็จ" }); 
  }
});

app.delete('/api/tasks/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM tasks WHERE id = ?', [req.params.id]);
    res.json({ message: "ลบงานสำเร็จ" });
  } catch (error) { 
    console.error("Delete Task Error:", error.message);
    res.status(500).json({ error: "ลบงานไม่สำเร็จ" }); 
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
})  