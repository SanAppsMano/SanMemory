let ws, room, modeSelected="multi";

function startGame(mode){
  modeSelected = mode;
  room = crypto.randomUUID().slice(0,5);

  ws = new WebSocket(location.origin.replace("http","ws")+"/ws/"+room);

  ws.onopen = () => {
    ws.send(JSON.stringify({
      type:"start",
      mode:modeSelected,
      totalCards:12
    }));
    renderQRs();
  };

  ws.onmessage = e => {
    const msg = JSON.parse(e.data);
    if(msg.type==="board") setupBoard(msg.board);
    if(msg.type==="state") applyState(msg);
    if(msg.type==="turn") showTurn(msg.turn);
    if(msg.type==="end") showWinner(msg);
  };

  document.getElementById("status").textContent = "Sala "+room+" — "+mode;
}

function renderQRs(){
  new QRious({
    element: document.getElementById("qr1"),
    value: location.origin+"/controller.html?player=1&room="+room,
    size: 130
  });

  if(modeSelected==="multi"){
    new QRious({
      element: document.getElementById("qr2"),
      value: location.origin+"/controller.html?player=2&room="+room,
      size: 130
    });
  }else{
    document.getElementById("qr2").innerHTML="";
  }
}

let ctx,W,H,cards=[],matched=[],revealed=[];

function setupBoard(arr){
  const cv=document.getElementById("board");
  ctx=cv.getContext("2d");
  cv.width=350;
  cv.height=350;
  W=cv.width;H=cv.height;

  const cols=4, rows=3;
  cards=[];
  let i=0;
  for(let y=0;y<rows;y++){
    for(let x=0;x<cols;x++){
      cards.push({x,y,value:arr[i++]});
    }
  }
  draw();
}

function draw(){
  ctx.clearRect(0,0,W,H);
  const pad=6, cols=4, rows=3;
  const cw=(W-pad*(cols+1))/cols;
  const ch=(H-pad*(rows+1))/rows;

  for(let i=0;i<cards.length;i++){
    const c=cards[i];
    const x=pad+c.x*(cw+pad);
    const y=pad+c.y*(ch+pad);

    if(matched.includes(i)) ctx.fillStyle="#0a0";
    else if(revealed.includes(i)) ctx.fillStyle="#777";
    else ctx.fillStyle="#333";

    ctx.fillRect(x,y,cw,ch);
    ctx.strokeStyle="#aaa";
    ctx.strokeRect(x,y,cw,ch);

    if(matched.includes(i) || revealed.includes(i)){
      ctx.fillStyle="#fff";
      ctx.font=Math.floor(ch*0.4)+"px Arial";
      ctx.textAlign="center";
      ctx.textBaseline="middle";
      ctx.fillText(c.value,x+cw/2,y+ch/2);
    }
  }
}

function applyState(msg){
  matched=msg.matched;
  revealed=msg.revealed;
  draw();
}

function showTurn(t){
  document.getElementById("status").textContent =
    "Sala "+room+" — vez do jogador "+t;
}

function showWinner(msg){
  document.getElementById("status").textContent =
    "Fim do jogo — Vencedor: Jogador "+msg.winner;
}
