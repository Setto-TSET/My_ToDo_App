require('dotenv').config();
const mysql = require('mysql2/promise');

async function setupDB() {
  try {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASS,
      database: process.env.DB_NAME,
      port: process.env.DB_PORT || 3306
    });

    console.log("🟢 เชื่อมต่อฐานข้อมูล Railway สำเร็จ! กำลังสร้างตาราง...");

    await connection.query(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(255) UNIQUE NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL
      )
    `);
    console.log("✅ 1. สร้างตาราง users สำเร็จ");

    await connection.query(`
      CREATE TABLE IF NOT EXISTS categories (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        user_id INT,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);
    console.log("✅ 2. สร้างตาราง categories สำเร็จ");

    await connection.query(`
      CREATE TABLE IF NOT EXISTS tasks (
        id INT AUTO_INCREMENT PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        status VARCHAR(50) DEFAULT 'Pending',
        due_date DATE,
        category_id INT,
        owner_id INT,
        FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL,
        FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);
    console.log("✅ 3. สร้างตาราง tasks สำเร็จ");

    await connection.query(`
      CREATE TABLE IF NOT EXISTS task_assignees (
        task_id INT,
        user_id INT,
        PRIMARY KEY (task_id, user_id),
        FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);
    console.log("✅ 4. สร้างตาราง task_assignees สำเร็จ");

    console.log("🎉 สร้างตารางทั้งหมดบนคลาวด์เสร็จสมบูรณ์!");
    process.exit();
  } catch (error) {
    console.error("❌ เกิดข้อผิดพลาด:", error.message);
    process.exit(1);
  }
}

setupDB();