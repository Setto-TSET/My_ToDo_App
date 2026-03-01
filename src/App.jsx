import React, { useState, useEffect } from 'react';
import { CheckCircle, Clock, List, Plus, Search, Tag, X, Trash2, LogOut, User, Lock, Mail, Filter } from 'lucide-react';

// ✨ จุดสำคัญ: ตรวจสอบให้แน่ใจว่าใช้ https:// นำหน้าเสมอ
const API_URL = 'https://mytodoapp-production-db0e.up.railway.app';

export default function App() {
  const [token, setToken] = useState(localStorage.getItem('token') || null);
  const [currentUser, setCurrentUser] = useState(JSON.parse(localStorage.getItem('user')) || null);
  const [isRegistering, setIsRegistering] = useState(false);
  const [authForm, setAuthForm] = useState({ username: '', email: '', password: '' });
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [isResetPage, setIsResetPage] = useState(false);
  const [resetData, setResetData] = useState({ email: '', newPassword: '' });

  const [tasks, setTasks] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('All');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newTask, setNewTask] = useState({ 
    title: '', category: 'Work', status: 'Pending', dueDate: '', assignees: '' 
  });
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);

  // ตรวจสอบหน้า Reset Password จาก URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const emailParam = params.get('email');
    // เช็คทั้ง pathname หรือ params เพื่อความชัวร์บน Vercel
    if (window.location.pathname.includes('reset-password') || emailParam) {
      setIsResetPage(true);
      if (emailParam) setResetData(prev => ({ ...prev, email: emailParam }));
    }
    if (token) fetchTasks();
  }, [token]);

  const fetchTasks = async () => {
    try {
      const response = await fetch(`${API_URL}/api/tasks`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setTasks(data);
      } else if (response.status === 401) handleLogout();
    } catch (error) { console.error("Fetch Error:", error); }
  };

  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    const endpoint = isRegistering ? '/api/register' : '/api/login';
    try {
      const res = await fetch(`${API_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(authForm)
      });
      const data = await res.json();
      if (res.ok) {
        if (isRegistering) {
          alert('สมัครสมาชิกสำเร็จ! กรุณาเข้าสู่ระบบ');
          setIsRegistering(false);
        } else {
          setToken(data.token);
          setCurrentUser(data.user);
          localStorage.setItem('token', data.token);
          localStorage.setItem('user', JSON.stringify(data.user));
        }
      } else alert(data.error || "เกิดข้อผิดพลาด");
    } catch (error) { alert('ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ HTTPS ได้'); }
  };

  const handleLogout = () => {
    setToken(null);
    setCurrentUser(null);
    localStorage.clear();
    setTasks([]);
    window.location.href = "/";
  };

  // --- Task Operations ---
  const handleClearCompleted = async () => {
    if (!window.confirm("คุณต้องการลบงานที่สำเร็จแล้วทั้งหมดใช่หรือไม่?")) return;
    try {
      const res = await fetch(`${API_URL}/api/tasks/completed`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        setTasks(tasks.filter(t => t.status !== 'Completed'));
      }
    } catch (error) { console.error("Clear Error:", error); }
  };

  const handleDeleteTask = async (id) => {
    if (!window.confirm("คุณต้องการลบงานนี้ใช่หรือไม่?")) return;
    try {
      const res = await fetch(`${API_URL}/api/tasks/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        setTasks(tasks.filter(t => t.id !== id));
        setIsDetailModalOpen(false);
      }
    } catch (error) { console.error("Delete Error:", error); }
  };

  const handleUpdateTask = async (field, value) => {
    const updatedTask = { ...selectedTask, [field]: value };
    setSelectedTask(updatedTask);
    setTasks(tasks.map(t => t.id === selectedTask.id ? updatedTask : t));
    try {
      await fetch(`${API_URL}/api/tasks/${selectedTask.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(updatedTask)
      });
    } catch (error) { console.error("Update Error:", error); }
  };

  const filteredTasks = tasks.filter(task => {
    const matchesSearch = task.title.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === 'All' || task.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  // --- Render Reset Password Page ---
  if (!token && isResetPage) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
        <div className="bg-white p-8 rounded-3xl shadow-xl w-full max-w-md border border-green-50">
          <div className="flex flex-col items-center mb-6">
            <div className="bg-green-100 p-4 rounded-full text-green-600 mb-4"><Lock size={40} /></div>
            <h2 className="text-2xl font-bold text-gray-800">Set New Password</h2>
            <p className="text-sm text-gray-400 mt-2 italic text-center">Resetting for: {resetData.email}</p>
          </div>
          <form onSubmit={async (e) => {
            e.preventDefault();
            try {
              const res = await fetch(`${API_URL}/api/reset-password`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: resetData.email, newPassword: resetData.newPassword })
              });
              if (res.ok) {
                alert("✅ เปลี่ยนรหัสผ่านสำเร็จ! กรุณาเข้าสู่ระบบด้วยรหัสใหม่");
                window.location.href = "/";
              } else alert("❌ เกิดข้อผิดพลาดในการเปลี่ยนรหัส");
            } catch (err) { alert("❌ ไม่สามารถติดต่อเซิร์ฟเวอร์ได้"); }
          }} className="space-y-4">
            <input required type="password" placeholder="New Password (min 6 chars)" 
              className="w-full border p-3 rounded-xl focus:ring-2 focus:ring-green-500 outline-none"
              value={resetData.newPassword} onChange={e => setResetData({...resetData, newPassword: e.target.value})} />
            <button type="submit" className="w-full bg-green-600 text-white py-3 rounded-xl font-bold shadow-lg hover:bg-green-700 transition">Update Password</button>
            <button type="button" onClick={() => window.location.href="/"} className="w-full text-gray-400 text-sm">Cancel</button>
          </form>
        </div>
      </div>
    );
  }

  // --- Render Forgot Password Flow ---
  if (!token && isForgotPassword) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
        <div className="bg-white p-8 rounded-2xl shadow-lg w-full max-w-md">
          <div className="flex flex-col items-center mb-6">
            <div className="bg-blue-100 p-4 rounded-full text-blue-600 mb-4"><Mail size={40} /></div>
            <h2 className="text-2xl font-bold text-center">Forgot Password</h2>
            <p className="text-gray-500 text-center mt-2 text-sm">เราจะส่งลิงก์กู้คืนรหัสผ่านไปให้ทางอีเมลครับ</p>
          </div>
          <form onSubmit={async (e) => {
            e.preventDefault();
            try {
              const res = await fetch(`${API_URL}/api/forgot-password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: resetEmail })
              });
              const data = await res.json();
              alert(data.message || "หากมีอีเมลในระบบ เราได้ส่งลิงก์ไปแล้วครับ");
              setIsForgotPassword(false);
            } catch (err) { alert("❌ ระบบขัดข้อง"); }
          }} className="space-y-4">
            <input type="email" placeholder="Enter your registered email" required className="w-full border p-3 rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
              value={resetEmail} onChange={e => setResetEmail(e.target.value)} />
            <button type="submit" className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold hover:bg-blue-700 transition">Send Reset Link</button>
            <button type="button" onClick={() => setIsForgotPassword(false)} className="w-full text-gray-400 text-sm mt-2">Back to Login</button>
          </form>
        </div>
      </div>
    );
  }

  // --- Render Login/Register Page ---
  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
        <div className="bg-white p-8 rounded-2xl shadow-lg w-full max-w-md border border-gray-100">
          <h2 className="text-3xl font-bold text-center text-gray-800 mb-6">{isRegistering ? 'Join Us' : 'Welcome Back'}</h2>
          <form onSubmit={handleAuthSubmit} className="space-y-5">
            <input required placeholder="Username or Email" className="w-full border p-3 rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
              value={authForm.username} onChange={e => setAuthForm({...authForm, username: e.target.value})} />
            {isRegistering && <input required type="email" placeholder="Email Address" className="w-full border p-3 rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
              value={authForm.email} onChange={e => setAuthForm({...authForm, email: e.target.value})} />}
            <input required type="password" placeholder="Password" className="w-full border p-3 rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
              value={authForm.password} onChange={e => setAuthForm({...authForm, password: e.target.value})} />
            {!isRegistering && (
              <div className="text-right"><button type="button" onClick={() => setIsForgotPassword(true)} className="text-blue-600 text-xs font-semibold hover:underline">Forgot Password?</button></div>
            )}
            <button type="submit" className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold hover:bg-blue-700 transition shadow-md">
              {isRegistering ? 'Register' : 'Sign In'}
            </button>
          </form>
          <button onClick={() => setIsRegistering(!isRegistering)} className="w-full mt-6 text-sm text-gray-500 hover:text-blue-600 transition">
            {isRegistering ? 'Already have an account? Sign In' : "Don't have an account? Sign Up"}
          </button>
        </div>
      </div>
    );
  }

  // --- Main Dashboard Render ---
  return (
    <div className="p-8 bg-gray-50 min-h-screen font-sans">
      {/* Header Section */}
      <div className="max-w-6xl mx-auto mb-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-gray-800">Task Dashboard</h1>
          <p className="text-gray-400 text-sm mt-1">ยินดีต้อนรับกลับมา, <span className="text-blue-600 font-bold">{currentUser?.username}</span></p>
        </div>
        <div className="flex gap-3 w-full md:w-auto">
          <button onClick={handleClearCompleted} className="bg-red-50 text-red-600 px-4 py-2.5 rounded-xl flex items-center justify-center gap-2 font-bold hover:bg-red-500 hover:text-white transition border border-red-100">
            <Trash2 size={18}/> Clear Completed
          </button>
          <button onClick={() => setIsModalOpen(true)} className="flex-1 md:flex-none bg-blue-600 text-white px-6 py-2.5 rounded-xl flex items-center justify-center gap-2 font-bold hover:bg-blue-700 transition shadow-lg shadow-blue-100">
            <Plus size={20}/> Add Task
          </button>
          <button onClick={handleLogout} className="bg-white text-gray-400 border border-gray-100 px-4 py-2.5 rounded-xl hover:text-red-500 transition"><LogOut size={18}/></button>
        </div>
      </div>

      {/* Filter & Search Section */}
      <div className="max-w-6xl mx-auto mb-6 flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative w-full md:max-w-md">
          <Search className="absolute left-4 top-3 text-gray-300" size={18} />
          <input type="text" placeholder="Search tasks..." className="w-full pl-11 pr-4 py-2.5 rounded-2xl border-none shadow-sm focus:ring-2 focus:ring-blue-500 outline-none text-sm"
            value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
        </div>
        <div className="flex bg-white p-1 rounded-2xl shadow-sm gap-1 w-full md:w-auto overflow-x-auto">
          {['All', 'Pending', 'In Progress', 'Completed'].map((status) => (
            <button key={status} onClick={() => setFilterStatus(status)} className={`px-4 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap ${filterStatus === status ? 'bg-blue-600 text-white shadow-md' : 'text-gray-400 hover:text-gray-600'}`}>{status}</button>
          ))}
        </div>
      </div>

      {/* Tasks Table */}
      <div className="max-w-6xl mx-auto bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-gray-50/50 text-gray-400 font-bold text-[10px] uppercase tracking-widest border-b">
              <tr>
                <th className="px-8 py-5">Task Name</th>
                <th className="px-8 py-5">Creator</th>
                <th className="px-8 py-5">Status</th>
                <th className="px-8 py-5">Due Date</th>
                <th className="px-8 py-5">Assignees</th> 
                <th className="px-8 py-5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filteredTasks.length > 0 ? filteredTasks.map(task => (
                <tr key={task.id} className="hover:bg-blue-50/30 transition cursor-pointer group">
                  <td className="px-8 py-5" onClick={() => { setSelectedTask(task); setIsDetailModalOpen(true); }}>
                    <span className="font-bold text-gray-700 group-hover:text-blue-600 transition">{task.title}</span>
                    <td className="px-8 py-5 text-sm text-blue-600 font-medium">@{task.ownerName}</td>
                  </td>
                  
                  <td className="px-8 py-5" onClick={() => { setSelectedTask(task); setIsDetailModalOpen(true); }}>
                    <span className={`px-3 py-1 rounded-full text-[10px] font-bold ${task.status === 'Completed' ? 'bg-green-100 text-green-700' : task.status === 'In Progress' ? 'bg-blue-100 text-blue-700' : 'bg-yellow-100 text-yellow-700'}`}>{task.status}</span>
                  </td>
                  <td className="px-8 py-5 text-gray-400 text-sm" onClick={() => { setSelectedTask(task); setIsDetailModalOpen(true); }}>
                    {task.dueDate || '-'}
                  </td>
                  <td className="px-8 py-5">
                    <div className="flex -space-x-2 overflow-hidden">
                      {task.assignees?.map((name, i) => (
                        <div key={i} title={name} className="w-8 h-8 rounded-full bg-blue-600 border-2 border-white flex items-center justify-center text-[10px] text-white font-bold shadow-sm">{name.charAt(0).toUpperCase()}</div>
                      ))}
                    </div>
                  </td>
                  <td className="px-8 py-5 text-right">
                    <button onClick={(e) => { e.stopPropagation(); handleDeleteTask(task.id); }} className="text-gray-300 hover:text-red-500 transition"><Trash2 size={18}/></button>
                  </td>
                </tr>
              )) : (
                <tr><td colSpan="5" className="px-8 py-20 text-center text-gray-400 italic font-medium">No tasks found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Task Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex justify-center items-center z-50 p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-8 animate-in fade-in zoom-in duration-200">
            <div className="flex justify-between items-center mb-6 border-b pb-4">
              <h2 className="text-2xl font-bold text-gray-800">Create New Task</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600 transition"><X/></button>
            </div>
            <form onSubmit={async (e) => {
              e.preventDefault();
              try {
                const res = await fetch(`${API_URL}/api/tasks`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                  body: JSON.stringify(newTask)
                });
                if (res.ok) {
                  setIsModalOpen(false);
                  setNewTask({ title: '', category: 'Work', status: 'Pending', dueDate: '', assignees: '' });
                  fetchTasks();
                } else alert("❌ สร้างงานไม่สำเร็จ");
              } catch (err) { alert("❌ ไม่สามารถติดต่อเซิร์ฟเวอร์ได้"); }
            }} className="space-y-4">
              <input required type="text" placeholder="Task Title" className="w-full bg-gray-50 border-none p-3 rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
                value={newTask.title} onChange={e => setNewTask({...newTask, title: e.target.value})} />
              <input type="text" placeholder="Assignees (e.g. golf, user01)" className="w-full bg-gray-50 border-none p-3 rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
                value={newTask.assignees} onChange={e => setNewTask({...newTask, assignees: e.target.value})} />
              <div className="grid grid-cols-2 gap-4">
                <select className="bg-gray-50 border-none p-3 rounded-xl outline-none focus:ring-2 focus:ring-blue-500" value={newTask.category} onChange={e => setNewTask({...newTask, category: e.target.value})}>
                  <option value="Work">Work</option><option value="Personal">Personal</option><option value="Education">Education</option>
                </select>
                <input type="date" className="bg-gray-50 border-none p-3 rounded-xl outline-none focus:ring-2 focus:ring-blue-500" 
                  value={newTask.dueDate} onChange={e => setNewTask({...newTask, dueDate: e.target.value})} />
              </div>
              <button type="submit" className="w-full bg-blue-600 text-white py-3.5 rounded-2xl font-bold shadow-lg hover:bg-blue-700 transition">Create Task</button>
            </form>
          </div>
        </div>
      )}

      {/* Task Detail Modal */}
      {isDetailModalOpen && selectedTask && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex justify-center items-center z-50 p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-8 overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="flex justify-between items-start mb-6 border-b pb-4">
              <h3 className="text-2xl font-bold text-gray-800">{selectedTask.title}</h3>
              <button onClick={() => setIsDetailModalOpen(false)} className="text-gray-400 hover:bg-gray-100 rounded-full p-1 transition"><X size={24}/></button>
            </div>
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div><label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Status</label>
                <select className="w-full bg-gray-50 border-none rounded-xl px-3 py-2 text-sm font-semibold focus:ring-2 focus:ring-blue-500 transition" value={selectedTask.status} onChange={(e) => handleUpdateTask('status', e.target.value)}>
                  <option value="Pending">🕒 Pending</option><option value="In Progress">🚀 In Progress</option><option value="Completed">✅ Completed</option>
                </select>
              </div>
              <div><label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Due Date</label>
                <input type="date" className="w-full bg-gray-50 border-none rounded-xl px-3 py-2 text-sm font-semibold focus:ring-2 focus:ring-blue-500 transition" value={selectedTask.dueDate || ''} onChange={(e) => handleUpdateTask('dueDate', e.target.value)} />
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setIsDetailModalOpen(false)} className="flex-1 bg-gray-100 text-gray-600 py-3 rounded-2xl font-bold hover:bg-gray-200 transition">Close</button>
              <button onClick={() => handleDeleteTask(selectedTask.id)} className="flex-1 bg-red-50 text-red-500 py-3 rounded-2xl font-bold hover:bg-red-500 hover:text-white transition">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}