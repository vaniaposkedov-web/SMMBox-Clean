// backend/src/controllers/authController.js
const axios = require('axios');
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const VK_CLIENT_ID = process.env.VK_CLIENT_ID;
const VK_CLIENT_SECRET = process.env.VK_CLIENT_SECRET;
const VK_REDIRECT_URI = process.env.VK_REDIRECT_URI;

exports.getVkAuthUrl = (req, res) => {
    const url = `https://oauth.vk.com/authorize?client_id=${VK_CLIENT_ID}&display=page&redirect_uri=${VK_REDIRECT_URI}&scope=wall,groups,photos,offline&response_type=code&v=5.199`;
    res.json({ url });
};

exports.vkCallback = async (req, res) => {
    const { code } = req.query;

    if (!code) {
        return res.status(400).send('Код авторизации не найден');
    }

    try {
        const tokenResponse = await axios.get(`https://oauth.vk.com/access_token`, {
            params: {
                client_id: VK_CLIENT_ID,
                client_secret: VK_CLIENT_SECRET,
                redirect_uri: VK_REDIRECT_URI,
                code: code
            }
        });

        const { access_token, user_id, email } = tokenResponse.data;

        const userResponse = await axios.get(`https://api.vk.com/method/users.get`, {
            params: {
                user_ids: user_id,
                fields: 'photo_100',
                access_token: access_token,
                v: '5.199'
            }
        });

        const vkUser = userResponse.data.response[0];

        let user = await prisma.user.findFirst({
            where: { accounts: { some: { providerId: String(vkUser.id), provider: 'vk' } } }
        });

        if (!user) {
            user = await prisma.user.create({
                data: {
                    name: `${vkUser.first_name} ${vkUser.last_name}`,
                    email: email || null
                }
            });
        }

        await prisma.account.upsert({
            where: {
                provider_providerId: {
                    provider: 'vk',
                    providerId: String(vkUser.id)
                }
            },
            update: {
                accessToken: access_token,
                name: `${vkUser.first_name} ${vkUser.last_name}`,
                avatarUrl: vkUser.photo_100
            },
            create: {
                userId: user.id,
                provider: 'vk',
                providerId: String(vkUser.id),
                accessToken: access_token,
                name: `${vkUser.first_name} ${vkUser.last_name}`,
                avatarUrl: vkUser.photo_100
            }
        });

        const sessionToken = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: '7d' });

        res.cookie('token', sessionToken, { httpOnly: true, secure: process.env.NODE_ENV === 'production' });
        res.redirect(`${process.env.FRONTEND_URL}/dashboard`);

    } catch (error) {
        console.error('Ошибка авторизации VK:', error.response?.data || error.message);
        res.redirect(`${process.env.FRONTEND_URL}/accounts?error=vk_auth_failed`);
    }
};