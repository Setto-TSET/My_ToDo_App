import { useLocation } from "react-router-dom";
import { useState } from "react";
import axios from "axios";

function ResetPassword() {
  const location = useLocation();
  const query = new URLSearchParams(location.search);
  const token = query.get("token");

  const [newPassword, setNewPassword] = useState("");
  const [message, setMessage] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      await axios.put("/api/reset-password", {
        token,
        newPassword
      });

      setMessage("เปลี่ยนรหัสผ่านสำเร็จ!");
    } catch (err) {
      setMessage("ลิงก์หมดอายุหรือไม่ถูกต้อง");
    }
  };

  return (
    <div style={{ textAlign: "center", marginTop: 50 }}>
      <h2>ตั้งรหัสผ่านใหม่</h2>
      <form onSubmit={handleSubmit}>
        <input
          type="password"
          placeholder="รหัสผ่านใหม่"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          required
        />
        <br /><br />
        <button type="submit">ยืนยัน</button>
      </form>
      <p>{message}</p>
    </div>
  );
}

export default ResetPassword;