// server.js - หน้าหลักของแอพพลิเคชั่น
const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const app = express();
const port = process.env.PORT || 3000;

// ตั้งค่า Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// เชื่อมต่อกับ MongoDB
mongoose.connect('mongodb://localhost:27017/whispeer_db', {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log('เชื่อมต่อกับ MongoDB สำเร็จ'))
.catch(err => console.error('ไม่สามารถเชื่อมต่อกับ MongoDB:', err));

// โมเดลข้อมูล (Schema)
const ReplySchema = new mongoose.Schema({
  text: String,
  createdAt: { type: Date, default: Date.now }
});

const MessageSchema = new mongoose.Schema({
  text: String,
  isPinned: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
  replies: [ReplySchema]
});

const UserSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  avatarColor: { type: String, default: '#c3e7f8' },
  messages: [MessageSchema]
});

const User = mongoose.model('User', UserSchema);

// API Routes
// ลงทะเบียนและล็อกอิน (จะสร้างผู้ใช้ใหม่หากยังไม่มี)
app.post('/api/login', async (req, res) => {
  try {
    const { username, password, avatarColor } = req.body;
    
    // ตรวจสอบว่ามีผู้ใช้นี้แล้วหรือไม่
    let user = await User.findOne({ username });
    
    if (user) {
      // ตรวจสอบรหัสผ่าน
      if (user.password !== password) {
        return res.status(401).json({ message: 'รหัสผ่านไม่ถูกต้อง' });
      }
      
      // อัพเดทสีอวาตาร์ถ้ามีการเปลี่ยนแปลง
      if (avatarColor && user.avatarColor !== avatarColor) {
        user.avatarColor = avatarColor;
        await user.save();
      }
    } else {
      // สร้างผู้ใช้ใหม่
      user = new User({
        username,
        password,
        avatarColor,
        messages: []
      });
      await user.save();
    }
    
    res.status(200).json({
      message: 'ล็อกอินสำเร็จ',
      username: user.username,
      avatarColor: user.avatarColor
    });
  } catch (error) {
    console.error('เกิดข้อผิดพลาดในการล็อกอิน:', error);
    res.status(500).json({ message: 'เกิดข้อผิดพลาดในระบบ' });
  }
});

// ดึงข้อมูลผู้ใช้
app.get('/api/user/:username', async (req, res) => {
  try {
    const { username } = req.params;
    const user = await User.findOne({ username });
    
    if (!user) {
      return res.status(404).json({ message: 'ไม่พบผู้ใช้งาน' });
    }
    
    // จัดรูปแบบข้อมูลที่จะส่งกลับ
    const userData = {
      username: user.username,
      avatarColor: user.avatarColor,
      messages: user.messages.map(msg => msg.text)
    };
    
    res.status(200).json(userData);
  } catch (error) {
    console.error('เกิดข้อผิดพลาดในการดึงข้อมูลผู้ใช้:', error);
    res.status(500).json({ message: 'เกิดข้อผิดพลาดในระบบ' });
  }
});

// ค้นหาผู้ใช้
app.get('/api/search/:username', async (req, res) => {
  try {
    const searchTerm = req.params.username;
    const users = await User.find({ 
      username: { $regex: searchTerm, $options: 'i' } 
    }).select('username');
    
    res.status(200).json(users);
  } catch (error) {
    console.error('เกิดข้อผิดพลาดในการค้นหาผู้ใช้:', error);
    res.status(500).json({ message: 'เกิดข้อผิดพลาดในระบบ' });
  }
});

// ส่งข้อความนิรนาม
app.post('/api/message', async (req, res) => {
  try {
    const { targetUsername, message } = req.body;
    
    const user = await User.findOne({ username: targetUsername });
    
    if (!user) {
      return res.status(404).json({ message: 'ไม่พบผู้ใช้งาน' });
    }
    
    user.messages.push({ text: message });
    await user.save();
    
    res.status(200).json({ message: 'ส่งข้อความสำเร็จ' });
  } catch (error) {
    console.error('เกิดข้อผิดพลาดในการส่งข้อความ:', error);
    res.status(500).json({ message: 'เกิดข้อผิดพลาดในระบบ' });
  }
});

// ลบข้อความ
app.delete('/api/message/:username/:index', async (req, res) => {
  try {
    const { username, index } = req.params;
    
    const user = await User.findOne({ username });
    
    if (!user) {
      return res.status(404).json({ message: 'ไม่พบผู้ใช้งาน' });
    }
    
    if (index >= user.messages.length || index < 0) {
      return res.status(400).json({ message: 'ไม่พบข้อความที่ต้องการลบ' });
    }
    
    user.messages.splice(index, 1);
    await user.save();
    
    res.status(200).json({ message: 'ลบข้อความสำเร็จ' });
  } catch (error) {
    console.error('เกิดข้อผิดพลาดในการลบข้อความ:', error);
    res.status(500).json({ message: 'เกิดข้อผิดพลาดในระบบ' });
  }
});

// ปักหมุดข้อความ
app.put('/api/pin/:username/:index', async (req, res) => {
  try {
    const { username, index } = req.params;
    
    const user = await User.findOne({ username });
    
    if (!user) {
      return res.status(404).json({ message: 'ไม่พบผู้ใช้งาน' });
    }
    
    if (index >= user.messages.length || index < 0) {
      return res.status(400).json({ message: 'ไม่พบข้อความที่ต้องการปักหมุด' });
    }
    
    // สลับค่า isPinned
    user.messages[index].isPinned = !user.messages[index].isPinned;
    await user.save();
    
    res.status(200).json({ 
      message: 'อัพเดทสถานะการปักหมุดสำเร็จ', 
      isPinned: user.messages[index].isPinned 
    });
  } catch (error) {
    console.error('เกิดข้อผิดพลาดในการปักหมุดข้อความ:', error);
    res.status(500).json({ message: 'เกิดข้อผิดพลาดในระบบ' });
  }
});

// เพิ่มการตอบกลับ
app.post('/api/reply', async (req, res) => {
  try {
    const { username, messageIndex, reply } = req.body;
    
    const user = await User.findOne({ username });
    
    if (!user) {
      return res.status(404).json({ message: 'ไม่พบผู้ใช้งาน' });
    }
    
    if (messageIndex >= user.messages.length || messageIndex < 0) {
      return res.status(400).json({ message: 'ไม่พบข้อความที่ต้องการตอบกลับ' });
    }
    
    user.messages[messageIndex].replies.push({ text: reply });
    await user.save();
    
    res.status(200).json({ message: 'เพิ่มการตอบกลับสำเร็จ' });
  } catch (error) {
    console.error('เกิดข้อผิดพลาดในการเพิ่มการตอบกลับ:', error);
    res.status(500).json({ message: 'เกิดข้อผิดพลาดในระบบ' });
  }
});

// เริ่มต้นเซิร์ฟเวอร์
app.listen(port, () => {
  console.log(`เซิร์ฟเวอร์ทำงานที่ http://localhost:${port}`);
});