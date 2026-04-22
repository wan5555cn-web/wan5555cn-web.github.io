const express = require('express');
const mongoose = require('mongoose');
const app = express();
mongoose.connect('mongodb://localhost/musicDB', { useNewUrlParser: true });

// 消息模型
const MessageSchema = new mongoose.Schema({
  content: String,
  ip: String,
  createdAt: { type: Date, default: Date.now }
});
const Message = mongoose.model('Message', MessageSchema);

// API路由（需在html前声明）
app.use(express.json());
app.post('/api/messages', async (req, res) => {
  try {
    const message = new Message({ content: req.body.text, ip: req.ip });
    await message.save();
    res.status(201).send('留言已存储');
  } catch (err) {
    res.status(500).send('服务器错误');
  }
});