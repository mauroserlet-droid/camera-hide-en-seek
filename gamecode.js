function genereerGeprogrammeerdeLink() {
    const kamer = document.getElementById('kamernaam').value.trim() || "MauroKamer";
    
    // We bouwen de HTML-structuur op zonder het woord 'script' voluit te schrijven
    const gameCode = `<!DOCTYPE html>
<html lang="nl">
<head>
    <meta charset="UTF-8">
    <title>Webcam Hunt - Live Game</title>
    <style>
        body { font-family: Arial, sans-serif; background-color: #121212; color: white; margin: 0; padding: 0; text-align: center; overflow: hidden; }
        #speelveld { position: relative; width: 800px; height: 600px; background-color: #222; margin: 20px auto; border: 6px solid #333; border-radius: 10px; overflow: hidden; }
        #videoContainer { position: absolute; top: 0; left: 0; width: 100%; height: 100%; display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 5px; z-index: 1; background: #000; }
        .webcamBox { position: relative; width: 100%; height: 100%; background: #222; border: 1px solid #444; }
        .webcamStream { width: 100%; height: 100%; object-fit: cover; }
        .cameraLabel { position: absolute; bottom: 5px; left: 50%; transform: translateX(-50%); background: rgba(0,0,0,0.7); padding: 2px 8px; border-radius: 4px; font-size: 12px; }
        .avatar { position: absolute; width: 50px; height: 80px; z-index: 5; cursor: pointer; transform-origin: bottom center; }
        .avatarBody { width: 50px; height: 80px; background-color: #3498db; border-radius: 10px; position: relative; }
        .avatarBody::before { content: ''; position: absolute; top: -25px; left: 10px; width: 30px; height: 30px; background-color: #ffdbac; border-radius: 50%; }
        .avatar.is-seeker .avatarBody { background-color: #e74c3c; } 
        .avatar.is-helper .avatarBody { background-color: #e67e22; } 
        .avatar.is-hider .avatarBody { background-color: #2ed573; }  
        .spelerNaam { position: absolute; top: -45px; left: 50%; transform: translateX(-50%); background: rgba(0,0,0,0.8); padding: 2px 6px; border-radius: 4px; font-size: 11px; white-space: nowrap; }
        #hud { background: rgba(0,0,0,0.8); padding: 15px; font-size: 18px; font-weight: bold; border-bottom: 3px solid #ff4757; }
        .btn-ready { padding: 10px 20px; font-size: 16px; background: #ff4757; color: white; border: none; border-radius: 5px; cursor: pointer; margin-top: 10px; font-weight: bold; }
    </style>
</head>
<body>
    <div id="hud">
        Kamer: ${kamer} | <span id="statusTekst">Klik op de knop om klaar te staan!</span>
        <br><button id="readyKnop" class="btn-ready" onclick="ikBenKlaar()">IK BEN KLAAR (START)</button>
    </div>
    <div id="speelveld">
        <div id="videoContainer"></div>
    </div>
    <sc` + `ript>
        let mijnId = "User_" + Math.floor(Math.random() * 10000);
        let mijnTeam = "PENDING";
        let spelersData = {};
        let spelerX = 375, spelerY = 250, spelerSchaal = 1.0;
        let alleKlaar = [];
        let lokaleStream = null;
        let countdown = 60;
        let timerLoop = null;

        const kanaal = new BroadcastChannel("bc_room_" + "${kamer}");

        kanaal.onmessage = (e) => {
            const d = e.data;
            if (d.sender === mijnId) return;

            if (d.type === "ready") {
                if (!alleKlaar.includes(d.sender)) {
                    alleKlaar.push(d.sender);
                    kanaal.postMessage({ type: "ready_sync", sender: mijnId });
                }
                updateLobbyStatus();
            }
            if (d.type === "ready_sync") {
                if (!alleKlaar.includes(d.sender)) alleKlaar.push(d.sender);
                updateLobbyStatus();
            }
            if (d.type === "start") {
                startDeRonde(d.seeker, d.hiders);
            }
            if (d.type === "loop") {
                if (spelersData[d.sender]) {
                    spelersData[d.sender].x = d.x;
                    spelersData[d.sender].y = d.y;
                    spelersData[d.sender].schaal = d.schaal;
                }
            }
            if (d.type === "tag") {
                if (d.target === mijnId) {
                    mijnTeam = "HELPER";
                    document.getElementById("statusTekst").innerText = "Je bent AF! Help de zoeker!";
                }
                if (spelersData[d.target]) spelersData[d.target].rol = "HELPER";
                document.getElementById("avatar-" + d.target).className = "avatar is-helper";
                checkWinnaar();
            }
            if (d.type === "timer") {
                countdown = d.tijd;
                document.getElementById("statusTekst").innerText = "Tijd over: " + countdown + "s | Rol: " + mijnTeam;
                if (countdown <= 0) stopSpel("HIDERS");
            }
        };

        function ikBenKlaar() {
            document.getElementById("readyKnop").style.display = "none";
            if (!alleKlaar.includes(mijnId)) alleKlaar.push(mijnId);
            kanaal.postMessage({ type: "ready", sender: mijnId });
            updateLobbyStatus();
        }

        function updateLobbyStatus() {
            if (mijnTeam !== "PENDING") return;
            document.getElementById("statusTekst").innerText = "Wachten op groep... (" + alleKlaar.length + " spelers klaar)";
            
            alleKlaar.sort();
            if (alleKlaar.length >= 2 && mijnId === alleKlaar[0]) {
                setTimeout(() => {
                    let s = alleKlaar[Math.floor(Math.random() * alleKlaar.length)];
                    let h = alleKlaar.filter(id => id !== s);
                    kanaal.postMessage({ type: "start", seeker: s, hiders: h });
                    startDeRonde(s, h);
                }, 1500);
            }
        }

        function startDeRonde(s, h) {
            mijnTeam = (mijnId === s) ? "SEEKER" : "HIDER";
            document.getElementById("statusTekst").innerText = "Ronde gestart! Rol: " + mijnTeam;
            
            alleKlaar.forEach(id => {
                let rol = (id === s) ? "SEEKER" : "HIDER";
                if (id !== mijnId) spelersData[id] = { x: 375, y: 250, schaal: 1.0, rol: rol };
                maakAvatar(id, rol);
            });

            if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
                navigator.mediaDevices.getUserMedia({ video: true, audio: false }).then(str => {
                    lokaleStream = str;
                    voegVideo(mijnId, str);
                });
            }

            if (mijnId === alleKlaar[0]) {
                timerLoop = setInterval(() => {
                    countdown--;
                    kanaal.postMessage({ type: "timer", tijd: countdown });
                    document.getElementById("statusTekst").innerText = "Tijd over: " + countdown + "s | Rol: " + mijnTeam;
                    if (countdown <= 0) { clearInterval(timerLoop); stopSpel("HIDERS"); }
                }, 1000);
            }

            window.addEventListener("keydown", (e) => {
                let s = 6;
                if (e.key === "ArrowLeft") spelerX -= s;
                if (e.key === "ArrowRight") spelerX += s;
                if (e.key === "ArrowUp") spelerY -= s;
                if (e.key === "ArrowDown") spelerY += s;
                
                if (spelerX < 0) spelerX = 0; if (spelerX > 750) spelerX = 750;
                if (spelerY < 30) spelerY = 30; if (spelerY > 520) spelerY = 520;
                
                kanaal.postMessage({ type: "loop", sender: mijnId, x: spelerX, y: spelerY, schaal: spelerSchaal });
            });

            setInterval(() => {
                let m = document.getElementById("avatar-" + mijnId);
                if (m) { m.style.left = spelerX + "px"; m.style.top = spelerY + "px"; }
                for (let id in spelersData) {
                    let o = document.getElementById("avatar-" + id);
                    if (o) { o.style.left = spelersData[id].x + "px"; o.style.top = spelersData[id].y + "px"; }
                }
            }, 1000 / 60);
        }

        function maakAvatar(id, rol) {
            let av = document.createElement("div");
            av.id = "avatar-" + id;
            av.className = "avatar is-" + rol.toLowerCase();
            let b = document.createElement("div"); b.className = "avatarBody"; av.appendChild(b);
            
            av.onclick = () => {
                if ((mijnTeam === "SEEKER" || mijnTeam === "HELPER") && spelersData[id] && spelersData[id].rol === "HIDER") {
                    kanaal.postMessage({ type: "tag", target: id });
                    spelersData[id].rol = "HELPER";
                    av.className = "avatar is-helper";
                    checkWinnaar();
                }
            };
            document.getElementById("speelveld").appendChild(av);
        }

        function checkWinnaar() {
            let h = 0;
            if (mijnTeam === "HIDER") h++;
            for (let id in spelersData) { if (spelersData[id].rol === "HIDER") h++; }
            if (h === 0) stopSpel("SEEKER");
        }

        function stopSpel(w) {
            clearInterval(timerLoop);
            alert("Ronde voorbij! Winnaar: " + w);
            location.reload();
        }

        function voegVideo(id, str) {
            let box = document.createElement("div"); box.className = "webcamBox";
            let v = document.createElement("video"); v.className = "webcamStream"; v.srcObject = str; v.autoplay = true; v.muted = true;
            box.appendChild(v); document.getElementById("videoContainer").appendChild(box);
        }
    </s` + `cript>
</body>
</html>`;

    const gecodeerdeCode = btoa(unescape(encodeURIComponent(gameCode)));
    const dataUrlLink = "data:text/html;base64," + gecodeerdeCode;

    document.getElementById('outputLink').value = dataUrlLink;
    document.getElementById('deellink-sectie').style.display = "block";
}
