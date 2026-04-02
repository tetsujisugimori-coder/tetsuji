const WebSocket = require("ws");

const port = process.env.PORT || 3000;

const wss = new WebSocket.Server({ port });

let users = {};
let currentSpeaker = null;

// ===== タイムアウト制御 =====
let speakerTimer = null;

function setSpeakerTimeout() {
    clearTimeout(speakerTimer);

    speakerTimer = setTimeout(() => {
        if (currentSpeaker) {
            console.log("タイムアウトで話者解除:", currentSpeaker);

            currentSpeaker = null;

            broadcast({
                type: "speaker",
                id: null
            });
        }
    }, 5000); // 5秒
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
        id: id
    }));

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

                currentSpeaker = id;

                console.log("話者:", id);

                broadcast({
                    type: "speaker",
                    id: id
                });

                setSpeakerTimeout();

            } else {

                // 拒否通知
                ws.send(JSON.stringify({
                    type: "busy"
                }));

                console.log("拒否:", id, "現在:", currentSpeaker);
            }
        }

        // ===== 発言終了 =====
        if (data.type === "stopTalk") {

            if (currentSpeaker === id) {

                console.log("発言終了:", id);

                currentSpeaker = null;

                broadcast({
                    type: "speaker",
                    id: null
                });

                clearTimeout(speakerTimer);
            }
        }
    });

    // ===== 切断 =====
    ws.on("close", () => {

        console.log("切断:", id);

        delete users[id];

        // 話者だった場合は解除
        if (currentSpeaker === id) {

            console.log("話者切断 → リセット");

            currentSpeaker = null;

            broadcast({
                type: "speaker",
                id: null
            });

            clearTimeout(speakerTimer);
        }
    });
});

console.log("Server running on port " + port);