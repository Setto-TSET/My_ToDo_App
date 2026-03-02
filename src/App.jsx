import React, { useState, useEffect } from 'react';
import { Plus, Search, X, Trash2, LogOut, Lock, Mail, Calendar, UserCircle } from 'lucide-react';

const API_URL = 'https://mytodoapp-production-db0e.up.railway.app';

export default function App() {
  const [token, setToken] = useState(localStorage.getItem('token') || null);
  const [currentUser, setCurrentUser] = useState(JSON.parse(localStorage.getItem('user')) || null);
  const [isRegistering, setIsRegistering] = useState(false);
  const [authForm, setAuthForm] = useState({ username: '', email: '', password: '' });
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  
  const [isResetPage, setIsResetPage] = useState(false);
  const [resetToken, setResetToken] = useState(''); 
  const [resetData, setResetData] = useState({ newPassword: '' });

  const [tasks, setTasks] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('All');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newTask, setNewTask] = useState({ 
    title: '', category: 'Work', status: 'Pending', dueDate: '', assignees: '' 
  });
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlToken = params.get('token');
    
    if (window.location.pathname.includes('reset-password') || urlToken) {
      setIsResetPage(true);
      if (urlToken) setResetToken(urlToken);
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

  const handleClearCompleted = async () => {
    if (!window.confirm("คุณต้องการลบงานที่สำเร็จแล้วทั้งหมดใช่หรือไม่?")) return;
    try {
      const res = await fetch(`${API_URL}/api/tasks/completed`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) setTasks(tasks.filter(t => t.status !== 'Completed'));
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

  //Render Functions for Auth
  if (!token && isResetPage) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
        <div className="bg-white p-6 sm:p-8 rounded-3xl shadow-xl w-full max-w-md border border-green-50">
          <div className="flex flex-col items-center mb-6">
            <div className="bg-green-100 p-4 rounded-full text-green-600 mb-4"><Lock size={40} /></div>
            <h2 className="text-2xl font-bold text-gray-800 text-center">Set New Password</h2>
            <p className="text-sm text-gray-400 mt-2 italic text-center">กรุณาตั้งรหัสผ่านใหม่ของคุณ</p>
          </div>
          <form onSubmit={async (e) => {
            e.preventDefault();
            try {
              const res = await fetch(`${API_URL}/api/reset-password`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token: resetToken, newPassword: resetData.newPassword })
              });
              
              const data = await res.json();
              
              if (res.ok) {
                alert("✅ เปลี่ยนรหัสผ่านสำเร็จ! กรุณาเข้าสู่ระบบด้วยรหัสใหม่");
                window.location.href = "/";
              } else alert(`❌ ${data.error || "เกิดข้อผิดพลาดในการเปลี่ยนรหัส"}`);
            } catch (err) { alert("❌ ไม่สามารถติดต่อเซิร์ฟเวอร์ได้"); }
          }} className="space-y-4">
            <input required type="password" placeholder="New Password (min 6 chars)" 
              className="w-full border p-3 rounded-xl focus:ring-2 focus:ring-green-500 outline-none"
              value={resetData.newPassword} onChange={e => setResetData({...resetData, newPassword: e.target.value})} />
            <button type="submit" className="w-full bg-green-600 text-white py-3 rounded-xl font-bold shadow-lg hover:bg-green-700 transition">Update Password</button>
            <button type="button" onClick={() => window.location.href="/"} className="w-full text-gray-400 text-sm py-2">Cancel</button>
          </form>
        </div>
      </div>
    );
  }

  if (!token && isForgotPassword) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
        <div className="bg-white p-6 sm:p-8 rounded-2xl shadow-lg w-full max-w-md">
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
            <button type="button" onClick={() => setIsForgotPassword(false)} className="w-full text-gray-400 text-sm mt-2 py-2">Back to Login</button>
          </form>
        </div>
      </div>
    );
  }

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
        <div className="bg-white p-6 sm:p-8 rounded-2xl shadow-lg w-full max-w-md border border-gray-100">
          <h2 className="text-3xl font-bold text-center text-gray-800 mb-6">{isRegistering ? 'Join Us' : 'Welcome Back'}</h2>
          <form onSubmit={handleAuthSubmit} className="space-y-4 sm:space-y-5">
            <input required placeholder="Username or Email" className="w-full border p-3 rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
              value={authForm.username} onChange={e => setAuthForm({...authForm, username: e.target.value})} />
            {isRegistering && <input required type="email" placeholder="Email Address" className="w-full border p-3 rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
              value={authForm.email} onChange={e => setAuthForm({...authForm, email: e.target.value})} />}
            <input required type="password" placeholder="Password" className="w-full border p-3 rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
              value={authForm.password} onChange={e => setAuthForm({...authForm, password: e.target.value})} />
            {!isRegistering && (
              <div className="text-right"><button type="button" onClick={() => setIsForgotPassword(true)} className="text-blue-600 text-xs font-semibold hover:underline py-1">Forgot Password?</button></div>
            )}
            <button type="submit" className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold hover:bg-blue-700 transition shadow-md">
              {isRegistering ? 'Register' : 'Sign In'}
            </button>
          </form>
          <button onClick={() => setIsRegistering(!isRegistering)} className="w-full mt-6 text-sm text-gray-500 transition py-2">
  {isRegistering ? ( <>
                Already have an account? <span className="text-blue-600 font-semibold hover:underline">Sign In</span>
              </>
               ) : (
              <>
              Don't have an account? <span className="text-blue-600 font-semibold hover:underline">Sign Up</span>
              </>
              )}
          </button>
        </div>
      </div>
    );
  }

  //Main Dashboard
  return (
    <div className="p-4 sm:p-8 bg-gray-50 min-h-screen font-sans pb-20 sm:pb-8">
      <div className="max-w-6xl mx-auto mb-6 sm:mb-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-800">Task Dashboard</h1>
          <p className="text-gray-400 text-xs sm:text-sm mt-1">ยินดีต้อนรับกลับมา, <span className="text-blue-600 font-bold">{currentUser?.username}</span></p>
        </div>
        <div className="grid grid-cols-2 md:flex gap-2 sm:gap-3 w-full md:w-auto mt-2 md:mt-0">
          <button onClick={handleClearCompleted} className="col-span-1 bg-red-50 text-red-600 px-3 sm:px-4 py-2.5 rounded-xl flex items-center justify-center gap-1 sm:gap-2 font-bold hover:bg-red-500 hover:text-white transition border border-red-100 text-xs sm:text-base">
            <Trash2 size={16}/> <span className="hidden sm:inline">Clear</span>
          </button>
          <button onClick={() => setIsModalOpen(true)} className="col-span-1 bg-blue-600 text-white px-3 sm:px-6 py-2.5 rounded-xl flex items-center justify-center gap-1 sm:gap-2 font-bold hover:bg-blue-700 transition shadow-lg shadow-blue-100 text-xs sm:text-base">
            <Plus size={18}/> Add Task
          </button>
          <button onClick={handleLogout} className="col-span-2 md:col-span-1 bg-white text-gray-500 border border-gray-200 px-4 py-2.5 rounded-xl hover:text-red-500 hover:bg-red-50 transition flex justify-center items-center gap-2 text-sm sm:text-base font-medium">
            <LogOut size={16}/> <span className="md:hidden">Logout</span>
          </button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto mb-6 flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="relative w-full md:max-w-md">
          <Search className="absolute left-4 top-3 text-gray-400" size={18} />
          <input type="text" placeholder="Search tasks..." className="w-full pl-11 pr-4 py-2.5 rounded-xl sm:rounded-2xl border border-gray-100 shadow-sm focus:ring-2 focus:ring-blue-500 outline-none text-sm"
            value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
        </div>
        <div className="flex bg-white p-1 rounded-xl sm:rounded-2xl shadow-sm gap-1 w-full md:w-auto overflow-x-auto scrollbar-hide border border-gray-100">
          {['All', 'Pending', 'In Progress', 'Completed'].map((status) => (
            <button key={status} onClick={() => setFilterStatus(status)} 
              className={`flex-1 sm:flex-none px-4 py-2 rounded-lg sm:rounded-xl text-xs sm:text-sm font-bold transition whitespace-nowrap 
              ${filterStatus === status ? 'bg-blue-600 text-white shadow-md' : 'text-gray-400 hover:text-gray-600'}`}>
              {status}
            </button>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-1 gap-3 md:hidden max-w-6xl mx-auto">
        {filteredTasks.length > 0 ? filteredTasks.map(task => (
          <div key={task.id} onClick={() => { setSelectedTask(task); setIsDetailModalOpen(true); }} 
               className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-col gap-3 active:scale-[0.98] transition">
            
            <div className="flex justify-between items-start gap-2">
              <div>
                <h3 className="font-bold text-gray-800 text-sm leading-tight">{task.title}</h3>
                <div className="flex items-center gap-1 mt-1 text-xs text-blue-600 font-medium">
                  <UserCircle size={12}/> {task.ownerName}
                </div>
              </div>
              <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold whitespace-nowrap 
                ${task.status === 'Completed' ? 'bg-green-100 text-green-700' : task.status === 'In Progress' ? 'bg-blue-100 text-blue-700' : 'bg-yellow-100 text-yellow-700'}`}>
                {task.status}
              </span>
            </div>
            <div className="flex justify-between items-end mt-1">
              <div className="flex items-center gap-1.5 text-xs text-gray-400">
                <Calendar size={12} /> {task.dueDate || 'No Due Date'}
              </div>
              <div className="flex -space-x-2">
                {task.assignees?.map((name, i) => (
                  <div key={i} className="w-6 h-6 rounded-full bg-blue-600 border border-white flex items-center justify-center text-[8px] text-white font-bold shadow-sm">
                    {name.charAt(0).toUpperCase()}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )) : (
          <div className="text-center py-10 bg-white rounded-2xl border border-gray-100 text-gray-400 italic font-medium text-sm">
            No tasks found
          </div>
        )}
      </div>
      <div className="hidden md:block max-w-6xl mx-auto bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
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
                <tr key={task.id} onClick={() => { setSelectedTask(task); setIsDetailModalOpen(true); }} className="hover:bg-blue-50/30 transition cursor-pointer group">
                  <td className="px-8 py-5 font-bold text-gray-700 group-hover:text-blue-600 transition">{task.title}</td>
                  <td className="px-8 py-5 text-sm text-blue-600 font-medium">@{task.ownerName}</td>
                  <td className="px-8 py-5">
                    <span className={`px-3 py-1.5 rounded-full text-[10px] font-bold ${task.status === 'Completed' ? 'bg-green-100 text-green-700' : task.status === 'In Progress' ? 'bg-blue-100 text-blue-700' : 'bg-yellow-100 text-yellow-700'}`}>{task.status}</span>
                  </td>
                  <td className="px-8 py-5 text-gray-400 text-sm">{task.dueDate || '-'}</td>
                  <td className="px-8 py-5">
                    <div className="flex flex-col gap-1">
                      <div className="flex -space-x-2">
                        {task.assignees?.map((name, i) => (
                          <div key={i} title={name} className="w-8 h-8 rounded-full bg-blue-600 border-2 border-white flex items-center justify-center text-[10px] text-white font-bold shadow-sm">{name.charAt(0).toUpperCase()}</div>
                        ))}
                      </div>
                      <span className="text-[10px] text-gray-400">{task.assignees?.join(', ')}</span>
                    </div>
                  </td>
                  <td className="px-8 py-5 text-right">
                    <button onClick={(e) => { e.stopPropagation(); handleDeleteTask(task.id); }} className="text-gray-300 hover:text-red-500 transition p-2 rounded-lg hover:bg-red-50"><Trash2 size={18}/></button>
                  </td>
                </tr>
              )) : (
                <tr><td colSpan="6" className="px-8 py-20 text-center text-gray-400 italic font-medium">No tasks found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex justify-center items-center z-50 p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-6 sm:p-8 animate-in fade-in zoom-in duration-200">
            <div className="flex justify-between items-center mb-5 sm:mb-6 border-b pb-3 sm:pb-4">
              <h2 className="text-xl sm:text-2xl font-bold text-gray-800">Create New Task</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600 bg-gray-50 hover:bg-gray-100 p-2 rounded-full transition"><X size={20}/></button>
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
              <input required type="text" placeholder="Task Title" className="w-full bg-gray-50 border border-gray-100 p-3.5 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-sm sm:text-base"
                value={newTask.title} onChange={e => setNewTask({...newTask, title: e.target.value})} />
              
              <input type="text" placeholder="Assignees (e.g. user01, user02)" className="w-full bg-gray-50 border border-gray-100 p-3.5 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-sm sm:text-base"
                value={newTask.assignees} onChange={e => setNewTask({...newTask, assignees: e.target.value})} />
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <select className="bg-gray-50 border border-gray-100 p-3.5 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-sm sm:text-base appearance-none" 
                  value={newTask.category} onChange={e => setNewTask({...newTask, category: e.target.value})}>
                  <option value="Work">Work</option><option value="Personal">Personal</option><option value="Education">Education</option>
                </select>
                <input type="date" className="bg-gray-50 border border-gray-100 p-3.5 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-sm sm:text-base" 
                  value={newTask.dueDate} onChange={e => setNewTask({...newTask, dueDate: e.target.value})} />
              </div>
              <button type="submit" className="w-full bg-blue-600 text-white py-3.5 sm:py-4 rounded-xl font-bold shadow-lg shadow-blue-200 hover:bg-blue-700 transition mt-2">Create Task</button>
            </form>
          </div>
        </div>
      )}

      {isDetailModalOpen && selectedTask && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex justify-center items-end sm:items-center z-50 p-0 sm:p-4">
          <div className="bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl w-full max-w-md p-6 sm:p-8 animate-in slide-in-from-bottom sm:zoom-in duration-200">
            <div className="flex justify-between items-start mb-6 border-b pb-4">
              <h3 className="text-xl sm:text-2xl font-bold text-gray-800 pr-4">{selectedTask.title}</h3>
              <button onClick={() => setIsDetailModalOpen(false)} className="text-gray-400 bg-gray-50 hover:bg-gray-100 rounded-full p-2 transition flex-shrink-0"><X size={20}/></button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
              <div><label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1.5">Status</label>
                <select className="w-full bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 text-sm font-semibold focus:ring-2 focus:ring-blue-500 transition appearance-none" 
                  value={selectedTask.status} onChange={(e) => handleUpdateTask('status', e.target.value)}>
                  <option value="Pending">🕒 Pending</option><option value="In Progress">🚀 In Progress</option><option value="Completed">✅ Completed</option>
                </select>
              </div>
              <div><label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1.5">Due Date</label>
                <input type="date" className="w-full bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 text-sm font-semibold focus:ring-2 focus:ring-blue-500 transition" 
                  value={selectedTask.dueDate || ''} onChange={(e) => handleUpdateTask('dueDate', e.target.value)} />
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setIsDetailModalOpen(false)} className="flex-1 bg-gray-100 text-gray-600 py-3.5 rounded-xl font-bold hover:bg-gray-200 transition text-sm sm:text-base">Close</button>
              <button onClick={() => handleDeleteTask(selectedTask.id)} className="flex-1 bg-red-50 text-red-600 py-3.5 rounded-xl font-bold hover:bg-red-500 hover:text-white transition flex justify-center items-center gap-2 text-sm sm:text-base">
                <Trash2 size={18}/> Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}