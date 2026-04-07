const WebSocket = require("ws");

const port = process.env.PORT || 3000;
const wss = new WebSocket.Server({ port });

let users = {};
let currentSpeaker = null;

// ===== タイムアウト =====
let speakerTimer = null;

function setSpeakerTimeout() {
    clearTimeout(speakerTimer);

    speakerTimer = setTimeout(() => {
        if (currentSpeaker) {
            console.log("タイムアウト解除:", currentSpeaker);

            currentSpeaker = null;

            broadcast({
                type: "speaker",
                id: null
            });
        }
    }, 5000);
}

// ===== 全体送信 =====
function broadcast(data) {
    Object.values(users).forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(data));
        }
    });
}

// ===== 接続 =====
wss.on("connection", ws => {

    const id = Math.random().toString(36).substr(2, 9);
    ws.id = id;

    users[id] = ws;

    console.log("接続:", id);

    // 自分のID送信
    ws.send(JSON.stringify({
        type: "yourId",
        id
    }));

    // ユーザー一覧
    broadcast({
        type: "userList",
        users: Object.keys(users)
    });

    ws.on("message", msg => {

        let data;
        try {
            data = JSON.parse(msg);
        } catch {
            return;
        }

        // ===== 発言要求 =====
        if (data.type === "requestTalk") {

            if (currentSpeaker === null) {

                currentSpeaker = ws.id;

                console.log("話者:", ws.id);

                broadcast({
                    type: "speaker",
                    id: ws.id
                });

                setSpeakerTimeout();

            } else {

                ws.send(JSON.stringify({
                    type: "busy"
                }));

                console.log("拒否:", ws.id);
            }
        }

       // ===== 発言終了 =====
    if (data.type === "stopTalk") {

        if (currentSpeaker === ws.id) {

            currentSpeaker = null;

            broadcast({
                type: "speaker",
                id: null
            });

            clearTimeout(speakerTimer);
        }
    }

    // ★ここに追加（文字起こし）
    if (data.type === "transcript") {
        broadcast({
            type: "transcript",
            id: data.id,
            text: data.text
        });
    }
});

    // ===== 切断 =====
    ws.on("close", () => {

        console.log("切断:", ws.id);

        delete users[ws.id];

        if (currentSpeaker === ws.id) {

            currentSpeaker = null;

            broadcast({
                type: "speaker",
                id: null
            });

            clearTimeout(speakerTimer);
        }

        broadcast({
            type: "userList",
            users: Object.keys(users)
        });
    });
});

console.log("Server running on port " + port);