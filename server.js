const express = require('express');
const axios = require('axios');
const path = require('path');
const { Client } = require('discord.js-selfbot-v13');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname)));

const MASTER_PASSWORD = "ZYRUU2024"; 
let activeBots = [];
let isWarmingUp = false;

const checkAuth = (req, res, next) => {
    if (req.headers['x-zyruu-auth'] === MASTER_PASSWORD) next();
    else res.status(401).json({ success: false, message: "Unauthorized." });
};

// --- 🛠️ WARM-UP ENGINE (Humanizer) ---
app.post('/api/start-warmup', checkAuth, async (req, res) => {
    if (isWarmingUp) return res.json({ success: false, message: "Warm-up already running." });
    
    const { tokens, voiceChannelId, textChannelId } = req.body;
    if (!tokens || tokens.length === 0) return res.json({ success: false, message: "No tokens provided." });
    
    isWarmingUp = true;
    res.json({ success: true, message: "Warm-up engine started in background." });

    for (const token of tokens) {
        try {
            const client = new Client({ checkUpdate: false });
            
            client.on('ready', async () => {
                console.log(`[WARMUP] ${client.user.tag} logged in.`);
                
                // Join Voice
                if (voiceChannelId) {
                    try {
                        const channel = client.channels.cache.get(voiceChannelId);
                        if (channel) {
                            await client.voice.joinChannel(channel, { selfMute: true, selfDeaf: true });
                            console.log(`[WARMUP] ${client.user.tag} joined voice.`);
                        }
                    } catch (e) { console.log(`[WARMUP] Voice error: ${e.message}`); }
                }

                // Chat Loop
                if (textChannelId) {
                    const phrases = ["yo", "lol", "fr", "whats good", "ngl", "sheesh", "anyone here"];
                    setInterval(async () => {
                        if (!isWarmingUp) return;
                        try {
                            const channel = client.channels.cache.get(textChannelId);
                            if (channel && Math.random() > 0.7) { // Random chance to chat
                                await channel.send(phrases[Math.floor(Math.random() * phrases.length)]);
                            }
                        } catch (e) {}
                    }, Math.floor(Math.random() * 60000) + 30000); // Every 30-90s
                }
            });

            await client.login(token);
            activeBots.push(client);
            // Stagger logins
            await new Promise(r => setTimeout(r, 5000));
        } catch (err) {
            console.log(`[WARMUP ERROR] Invalid token or login failed.`);
        }
    }
});

app.post('/api/stop-warmup', checkAuth, (req, res) => {
    isWarmingUp = false;
    activeBots.forEach(bot => {
        if (bot.voice) bot.voice.disconnect();
        bot.destroy();
    });
    activeBots = [];
    res.json({ success: true, message: "Warm-up stopped. Bots disconnected." });
});

// --- 🎯 TRIGGER ENGINE (Claimer) ---
app.post('/api/trigger', checkAuth, async (req, res) => {
    const { token } = req.body;
    if (!token) return res.status(400).json({ success: false, message: "No token provided" });

    const headers = {
        'Authorization': token,
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
        'X-Super-Properties': 'eyJvcyI6IldpbmRvd3MiLCJicm93c2VyIjoiQ2hyb21lIiwiZGV2aWNlIjoiIiwic3lzdGVtX2xvY2FsZSI6ImVuLVVTIiwiYnJvd3Nlcl91c2VyX2FnZW50IjoiTW96aWxsYS81LjAgKFdpbmRvd3MgTlQgMTAuMDsgV2luNjQ7IHg2NCkgQXBwbGVXZWJLaXQvNTM3LjM2IChLSFRNTCwgbGlrZSBHZWNrbykgQ2hyb21lLzEyMS4wLjAuMCBTYWZhcmkvNTM3LjM2IiwiYnJvd3Nlcl92ZXJzaW9uIjoiMTIxLjAuMC4wIiwib3NfdmVyc2lvbiI6IjEwIiwicmVsZWFzZV9jaGFubmVsIjoic3RhYmxlIiwiY2xpZW50X2J1aWxkX251bWJlciI6MjU4MDAwLCJjbGllbnRfZXZlbnRfc291cmNlIjpudWxsfQ=='
    };

    try {
        const checkRes = await axios.get('https://discord.com/api/v9/users/@me/billing/user-trial-offer', { headers, validateStatus: false });
        if (checkRes.status === 401) return res.json({ success: false, message: "Invalid Token" });
        if (checkRes.status === 429) return res.json({ success: false, message: "Rate Limited" });
        
        if (checkRes.status === 200 && checkRes.data.id) {
            const offerId = checkRes.data.id;
            const payRes = await axios.get('https://discord.com/api/v9/users/@me/billing/payment-sources', { headers, validateStatus: false });

            if (payRes.status === 200 && payRes.data.length > 0) {
                const validMethod = payRes.data.find(pm => pm.type === 1 || pm.type === 19); 
                if (!validMethod) return res.json({ success: false, message: "Offer found, but no valid Card/PayPal attached." });

                const claimRes = await axios.post(`https://discord.com/api/v9/users/@me/billing/user-trial-offer/${offerId}/ack`, {
                    "payment_gateway": validMethod.type === 1 ? "stripe" : "paypal",
                    "payment_method_id": validMethod.id
                }, { headers, validateStatus: false });

                if ([200, 201, 204].includes(claimRes.status)) return res.json({ success: true, message: "Nitro Triggered!" });
                else return res.json({ success: false, message: `Claim failed: ${claimRes.data.message}` });
            } else {
                return res.json({ success: false, message: "Offer found, but NO PAYMENT METHOD attached." });
            }
        } else {
            return res.json({ success: false, message: "No active offers found." });
        }
    } catch (error) {
        return res.status(500).json({ success: false, message: "Server Error" });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ ZYRUU SERVER running on port ${PORT}`));
