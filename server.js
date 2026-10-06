const express = require('express');
const axios = require('axios');
require('dotenv').config();

const app = express();
app.use(express.json());

app.use((req, res, next) => {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    next();
});

const PORT = process.env.PORT || 3000;
const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL;

// Endpoint nhận dữ liệu và gửi thông báo tới Discord
app.post('/send-notification', async (req, res) => {
    const { title, message, user } = req.body;

    if (!DISCORD_WEBHOOK_URL) {
        return res.status(500).json({ error: 'Chưa cấu hình DISCORD_WEBHOOK_URL' });
    }

    try {
        // Format tin nhắn dạng Embed cho đẹp mắt trên Discord
        const discordPayload = {
            username: "Hệ thống Thông báo",
            embeds: [
                {
                    title: title || "Thông báo mới!",
                    description: message || "Bạn có một cập nhật mới.",
                    color: 0x3498db, // Mã màu xanh lam (Hex)
                    fields: user ? [{ name: "Người nhận", value: user, inline: true }] : [],
                    timestamp: new Date().toISOString()
                }
            ]
        };

        // Gửi request POST sang Discord Webhook
        await axios.post(DISCORD_WEBHOOK_URL, discordPayload);

        return res.status(200).json({ success: true, message: 'Đã gửi thông báo thành công!' });
    } catch (error) {
        console.error('Lỗi gửi Webhook:', error.message);
        return res.status(500).json({ success: false, error: 'Không thể gửi thông báo' });
    }
});

// Endpoint kiểm tra server live
app.get('/', (req, res) => {
    res.send('Server Webhook đang chạy!');
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});