require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const mongoSanitize = require('express-mongo-sanitize');

// 初始化应用
const app = express();

// 安全中间件
app.use(helmet());
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
  methods: ['GET', 'POST']
}));
app.use(mongoSanitize());
app.use(express.json({ limit: '10kb' }));

// 请求限流
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15分钟
  max: 100 // 每个IP限制100次请求
});
app.use('/api', limiter);

// MongoDB连接
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost/musicDB', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverSelectionTimeoutMS: 5000
})
.then(() => console.log('MongoDB连接成功'))
.catch(err => console.error('MongoDB连接失败:', err));

// 消息模型
const messageSchema = new mongoose.Schema({
  content: { type: String, required: true, maxlength: 500 },
  ip: { type: String, required: true },
  createdAt: { type: Date, default: Date.now, index: true }
});
const Message = mongoose.model('Message', messageSchema);

// 静态资源托管
app.use(express.static('dist', {
  maxAge: '1d',
  setHeaders: (res) => {
    res.set('X-Content-Type-Options', 'nosniff');
  }
}));

// API路由
app.get('/api/messages', async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const [messages, total] = await Promise.all([
      Message.find().sort('-createdAt').skip(skip).limit(limit),
      Message.countDocuments()
    ]);

    res.json({
      success: true,
      data: messages,
      pagination: { page, limit, total }
    });
  } catch (err) {
    next(err);
  }
});

app.post('/api/messages', async (req, res, next) => {
  try {
    if (!req.body.content || req.body.content.trim().length === 0) {
      return res.status(400).json({ success: false, error: '内容不能为空' });
    }

    const message = new Message({
      content: req.body.content.trim(),
      ip: req.ip
    });

    await message.save();
    res.status(201).json({ success: true, message });
  } catch (err) {
    next(err);
  }
});

// 健康检查
app.get('/health', (req, res) => {
  res.json({
    status: 'UP',
    dbStatus: mongoose.connection.readyState === 1 ? 'CONNECTED' : 'DISCONNECTED',
    timestamp: new Date().toISOString()
  });
});

// 统一错误处理
app.use((err, req, res, next) => {
  console.error(`[${new Date().toISOString()}] Error:`, err.stack);
  
  res.status(500).json({
    success: false,
    error: process.env.NODE_ENV === 'production' 
      ? '服务器内部错误' 
      : err.message
  });
});

// 启动服务
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`服务运行中，端口: ${PORT}`);
  console.log(`环境: ${process.env.NODE_ENV || 'development'}`);
});

// 优雅关闭
process.on('SIGTERM', () => {
  mongoose.connection.close();
  console.log('服务已关闭');
  process.exit(0);
});