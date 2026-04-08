const WebSocket = require("ws");

const port = process.env.PORT || 3000;
const wss = new WebSocket.Server({ port });

let users = {};

function broadcastUserList(){
    const list = Object.keys(users).map(uid => ({
        id: uid,
        name: users[uid]?.name || uid
    }));

    wss.clients.forEach(client =>{
        if(client.readyState === WebSocket.OPEN){
            client.send(JSON.stringify({
            type: "userList",
            users: list
        }));
        }
        
    });
}
let currentSpeaker = null;
let speakerTimer = null;

// ===== タイムアウト =====
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
    Object.values(sockets).forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(data));
        }
    });
}

// ===== 接続 =====
let sockets ={};
wss.on("connection", ws => {

    const id = Math.random().toString(36).slice(2, 11);
    ws.id = id;

    sockets[id] = ws;

    console.log("接続:", id);

    // ===== 自分のID =====
    ws.send(JSON.stringify({
        type: "yourId",
        id
    }));

    // ===== 現在の話者を同期（重要）=====
    ws.send(JSON.stringify({
        type: "speaker",
        id: currentSpeaker
    }));

    // ===== ユーザー一覧 =====
    broadcastUserList();

    // ===== メッセージ受信 =====
    ws.on("message", msg => {

        let data;
        try {
            data = JSON.parse(msg);
        } catch {
            return;
        }

        //追加
        if(data.type === "setName"){
            users[data.id] = {
                name: data.name || data.id
            };
            broadcastUserList();
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

                console.log("終了:", ws.id);

                currentSpeaker = null;

                broadcast({
                    type: "speaker",
                    id: null
                });

                clearTimeout(speakerTimer);
            }
            
        }

        // ===== 文字起こし =====
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
        delete sockets[ws.id];

        // 話者が切断した場合
        if (currentSpeaker === ws.id) {

            currentSpeaker = null;

            broadcast({
                type: "speaker",
                id: null
            });

            clearTimeout(speakerTimer);
        }

        // ユーザー一覧更新
        broadcastUserList();
    });
});

console.log("Server running on port " + port);