const express = require('express');
const { Client, GatewayIntentBits, Partials, EmbedBuilder, AttachmentBuilder } = require('discord.js');
require('dotenv').config();

const app = express();

// Cho phép payload JSON lớn (đặc biệt khi client gửi kèm ảnh chụp màn hình base64)
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

app.use((req, res, next) => {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    next();
});

const PORT = process.env.PORT || 3000;
const BOT_TOKEN = process.env.BOT_TOKEN;
const CHANNEL_ID = process.env.CHANNEL_ID;
const EXE_DOWNLOAD_URL = process.env.EXE_DOWNLOAD_URL || 'https://github.com/silvadrag2006-a11y/discord-webhook-app/releases/latest';
const SHA256_HASH = process.env.SHA256_HASH || '43bf09957e2f765834d2d29c7b86262c3f8c3a55b9c82c5f8a5c27b82b05e0e3';

// Khởi tạo Discord Bot Client
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.DirectMessages
    ],
    partials: [
        Partials.Channel,
        Partials.Message
    ]
});

// Sự kiện khi Bot online
client.once('ready', () => {
    console.log(`🤖 Discord Bot đã đăng nhập thành công với tên: ${client.user.tag}`);
});

// Lắng nghe tin nhắn trên server
client.on('messageCreate', async (message) => {
    try {
        // Bỏ qua tin nhắn từ Bot
        if (message.author.bot) return;

        // Chỉ phản hồi khi lệnh !getapp được gửi đúng trong kênh chung (CHANNEL_ID)
        const isTargetChannel = !CHANNEL_ID || message.channelId === CHANNEL_ID;
        const content = message.content ? message.content.trim().toLowerCase() : '';

        if (content === '!getapp') {
            if (!isTargetChannel) {
                // Bỏ qua nếu lệnh gửi không đúng kênh chỉ định
                return;
            }

            const downloadEmbed = new EmbedBuilder()
                .setTitle('🚀 TẢI ỨNG DỤNG CLIENT PC-CONTROLLER')
                .setDescription('Sử dụng ứng dụng Client để theo dõi tiến trình làm việc trên PC và nhận thông báo cá nhân hóa trực tiếp qua Discord DM.')
                .setColor(0x5865F2) // Discord Blurple
                .addFields(
                    {
                        name: '🔗 Link Tải File Chạy (client.exe)',
                        value: `[**👉 Nhấn vào đây để tải client.exe**](${EXE_DOWNLOAD_URL})`
                    },
                    {
                        name: '🛡️ Mã Kiểm Tra Tính Toàn Vẹn (SHA-256 Checksum)',
                        value: `\`\`\`${SHA256_HASH}\`\`\``
                    },
                    {
                        name: '📋 Hướng Dẫn Cài Đặt Nhanh (3 Bước)',
                        value: 
                            '1️⃣ **Tải file:** Nhấp link trên để tải file `client.exe` về máy tính.\n' +
                            '2️⃣ **Lấy Discord User ID:** Bật *Cài đặt > Nâng cao > Chế độ nhà phát triển (Developer Mode)*. Sau đó chuột phải vào Avatar/Tên người dùng của bạn > chọn **Sao chép ID người dùng (Copy User ID)**.\n' +
                            '3️⃣ **Cấu hình Client:** Mở `client.exe`, nhập Server URL Render và dán Discord User ID của bạn vào cấu hình.'
                    }
                )
                .setFooter({ text: 'Hệ thống Quản lý & Báo cáo Tự động' })
                .setTimestamp();

            await message.reply({ embeds: [downloadEmbed] });
            console.log(`[Lệnh !getapp] Đã phản hồi tới ${message.author.tag} tại kênh ${message.channelId}`);
        }
    } catch (err) {
        console.error('Lỗi khi xử lý lệnh !getapp:', err);
    }
});

// Endpoint kiểm tra trạng thái sống của Server (Health Check)
app.get('/', (req, res) => {
    res.status(200).send('Server Webhook & Discord Bot đang chạy!');
});

// Endpoint nhận thông báo từ client.exe và gửi DM tới Discord User
app.post('/send-notification', async (req, res) => {
    const { title, message, user, discord_user_id, screenshot } = req.body;

    if (!discord_user_id) {
        return res.status(400).json({ 
            success: false, 
            error: 'Thiếu tham số bắt buộc "discord_user_id". Báo cáo bắt buộc phải gửi vào DM của người dùng!' 
        });
    }

    if (!client.isReady()) {
        return res.status(503).json({ 
            success: false, 
            error: 'Discord Bot chưa sẵn sàng hoặc chưa đăng nhập thành công.' 
        });
    }

    try {
        // Lấy thông tin user Discord theo ID
        const targetUser = await client.users.fetch(discord_user_id);
        if (!targetUser) {
            return res.status(404).json({ 
                success: false, 
                error: `Không tìm thấy người dùng Discord với ID: ${discord_user_id}` 
            });
        }

        // Tạo Embed thông báo
        const reportEmbed = new EmbedBuilder()
            .setTitle(title || '🔔 Báo cáo phiên làm việc mới')
            .setDescription(message || 'Có một thông báo mới từ PC của bạn.')
            .setColor(0x3498db) // Màu xanh lam (Hex)
            .setTimestamp();

        if (user) {
            reportEmbed.addFields({ name: '👤 Thiết bị / Người gửi', value: user, inline: true });
        }

        const files = [];

        // Xử lý đính kèm ảnh chụp màn hình nếu có
        if (screenshot && typeof screenshot === 'string') {
            if (screenshot.startsWith('http://') || screenshot.startsWith('https://')) {
                // Nếu là URL hình ảnh
                reportEmbed.setImage(screenshot);
            } else {
                // Nếu là chuỗi Base64
                try {
                    const base64Data = screenshot.replace(/^data:image\/\w+;base64,/, '');
                    const imageBuffer = Buffer.from(base64Data, 'base64');
                    const attachment = new AttachmentBuilder(imageBuffer, { name: 'screenshot.png' });
                    files.push(attachment);
                    reportEmbed.setImage('attachment://screenshot.png');
                } catch (imgError) {
                    console.warn('Lỗi phân tích cú pháp base64 screenshot:', imgError.message);
                }
            }
        }

        // GỬI TRỰC TIẾP VÀO TIN NHẮN RIÊNG (DM) - TUYỆT ĐỐI KHÔNG GỬI VÀO KÊNH CHUNG
        await targetUser.send({
            embeds: [reportEmbed],
            files: files
        });

        console.log(`[DM Notification] Đã gửi báo cáo thành công tới ${targetUser.tag} (${discord_user_id})`);
        return res.status(200).json({ 
            success: true, 
            message: `Đã gửi báo cáo thành công vào DM của người dùng ${targetUser.tag}!` 
        });

    } catch (error) {
        console.error(`[Lỗi gửi DM tới ${discord_user_id}]:`, error.message);
        
        // Bắt lỗi khi người dùng chặn DM hoặc tắt DM từ thành viên server chung
        if (error.code === 50007) {
            return res.status(403).json({
                success: false,
                error: 'Không thể gửi DM tới người dùng này. Người dùng có thể đã tắt nhận DM từ server hoặc chặn bot.'
            });
        }

        return res.status(500).json({ 
            success: false, 
            error: 'Lỗi khi gửi thông báo DM: ' + error.message 
        });
    }
});

// Khởi chạy Express Server
app.listen(PORT, () => {
    console.log(`🚀 Server HTTP đang lắng nghe trên cổng ${PORT}`);
});

// Đăng nhập Discord Bot
if (BOT_TOKEN) {
    client.login(BOT_TOKEN).catch((err) => {
        console.error('❌ Không thể đăng nhập Discord Bot:', err.message);
    });
} else {
    console.warn('⚠️ CẢNH BÁO: Chưa cấu hình BOT_TOKEN trong biến môi trường!');
}