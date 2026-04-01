const WebSocket = require("ws");

const port = process.env.PORT || 3000;

// サーバー起動
const wss = new WebSocket.Server({ port });

let users = {};
let currentSpeaker = null;

wss.on("connection", ws => {

    // サーバー側でID発行（安全）
    const id = Math.random().toString(36).substr(2, 9);
    ws.id = id;

    users[id] = ws;

    // 接続時にIDを返す
    ws.send(JSON.stringify({
        type: "yourId",
        id: id
    }));

    ws.on("message", msg => {

        let data;
        try {
            data = JSON.parse(msg);
        } catch (e) {
            return;
        }

        // 発言要求
        if (data.type === "requestTalk") {
            if (currentSpeaker === null) {
                currentSpeaker = id;

                broadcast({
                    type: "speaker",
                    id: id
                });
            }
        }

        // 発言終了
        if (data.type === "stopTalk") {
            if (currentSpeaker === id) {
                currentSpeaker = null;

                broadcast({
                    type: "speaker",
                    id: null
                });
            }
        }
    });

    // 切断処理
    ws.on("close", () => {

        delete users[id];

        if (currentSpeaker === id) {
            currentSpeaker = null;

            broadcast({
                type: "speaker",
                id: null
            });
        }
    });

    // 全員に送信
    function broadcast(data) {
        Object.values(users).forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify(data));
            }
        });
    }
});
