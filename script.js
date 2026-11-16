const EMPTY=0,BLACK=1,WHITE=2;
const DIRS=[[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]];
const $=id=>document.getElementById(id);
const jp=s=>JSON.parse('"'+s+'"');
let N=8,board,turn,finished,showHints,lastMove;
const storageKey=size=>size===8?"othello-game-state-v1":`othello-game-state-v1-${size}`;
const other=p=>p===BLACK?WHITE:BLACK;
const name=p=>p===BLACK?"BLACK":"WHITE";

function initialBoard(size){
  const b=Array.from({length:size},()=>Array(size).fill(EMPTY));
  const start=Math.floor(size/2)-1;
  b[start][start]=WHITE;b[start][start+1]=BLACK;b[start+1][start]=BLACK;b[start+1][start+1]=WHITE;
  return b;
}
function save(){
  try{localStorage.setItem(storageKey(N),JSON.stringify({size:N,board,turn,finished,showHints,lastMove}));}
  catch(error){console.warn("Could not save the game state.",error);}
}
function load(size){
  try{
    const saved=JSON.parse(localStorage.getItem(storageKey(size)));
    if(!saved||!(saved.size===size||(size===8&&saved.size===undefined))||!Array.isArray(saved.board)||saved.board.length!==size||!saved.board.every(row=>Array.isArray(row)&&row.length===size&&row.every(v=>[EMPTY,BLACK,WHITE].includes(v)))||![BLACK,WHITE].includes(saved.turn)||typeof saved.finished!=="boolean"||typeof saved.showHints!=="boolean"||!(saved.lastMove===null||(Array.isArray(saved.lastMove)&&saved.lastMove.length===2&&saved.lastMove.every(v=>Number.isInteger(v)&&v>=0&&v<size))))return false;
    N=size;board=saved.board;turn=saved.turn;finished=saved.finished;showHints=saved.showHints;lastMove=saved.lastMove;return true;
  }catch(error){return false;}
}
function hasSavedGame(size){const previous=[N,board,turn,finished,showHints,lastMove];const found=load(size);[N,board,turn,finished,showHints,lastMove]=previous;return found;}
function flipsAt(r,c,p){
  if(board[r][c]!==EMPTY)return [];
  const result=[];
  for(const [dr,dc] of DIRS){
    const line=[];let y=r+dr,x=c+dc;
    while(y>=0&&y<N&&x>=0&&x<N&&board[y][x]===other(p)){line.push([y,x]);y+=dr;x+=dc;}
    if(line.length&&y>=0&&y<N&&x>=0&&x<N&&board[y][x]===p)result.push(...line);
  }
  return result;
}
function legalMoves(p){
  const moves=[];for(let r=0;r<N;r++)for(let c=0;c<N;c++)if(flipsAt(r,c,p).length)moves.push([r,c]);return moves;
}
function scores(){
  let b=0,w=0;for(const row of board)for(const v of row){if(v===BLACK)b++;if(v===WHITE)w++;}
  return {b,w};
}
function move(r,c){
  if(finished)return;
  const flips=flipsAt(r,c,turn);if(!flips.length)return;
  board[r][c]=turn;for(const [y,x] of flips)board[y][x]=turn;
  lastMove=[r,c];turn=other(turn);let notice="";
  if(!legalMoves(turn).length){
    const passed=turn;turn=other(turn);
    if(!legalMoves(turn).length)finished=true;
    else notice=`${name(passed)} \\u306f\\u7F6E\\u3051\\u308B\\u5834\\u6240\\u304C\\u306A\\u3044\\u305F\\u3081\\u30D1\\u30B9\\u3057\\u307E\\u3059`;
  }
  render(notice);
}
function render(notice=""){
  const boardEl=$("board");boardEl.style.setProperty("--board-size",N);boardEl.innerHTML="";
  const moves=finished?[]:legalMoves(turn),legal=new Set(moves.map(([r,c])=>`${r},${c}`));
  for(let r=0;r<N;r++)for(let c=0;c<N;c++){
    const cell=document.createElement("button");cell.type="button";cell.className="cell";cell.setAttribute("role","gridcell");
    const v=board[r][c],key=`${r},${c}`;
    if(v){const stone=document.createElement("span");stone.className=`stone ${v===BLACK?"black":"white"}`;cell.append(stone);cell.setAttribute("aria-label",`${r+1}, ${c+1} ${name(v)}`);}
    else cell.setAttribute("aria-label",`${r+1}, ${c+1}`);
    if(!v&&showHints&&legal.has(key))cell.classList.add("hint");
    if(lastMove&&lastMove[0]===r&&lastMove[1]===c)cell.classList.add("last-move");
    cell.disabled=!!v||!legal.has(key)||finished;cell.addEventListener("click",()=>move(r,c));boardEl.append(cell);
  }
  const {b,w}=scores();$("blackScore").textContent=b;$("whiteScore").textContent=w;
  $("blackPanel").classList.toggle("active",!finished&&turn===BLACK);$("whitePanel").classList.toggle("active",!finished&&turn===WHITE);
  $("turnDot").className=`dot ${turn===BLACK?"black-dot":"white-dot"}`;
  if(finished){$("turnText").textContent="GAME OVER";const result=b===w?"DRAW":`${b>w?"BLACK":"WHITE"} WINS`;$("message").textContent=`${result}  BLACK ${b} - WHITE ${w}`;}
  else{$("turnText").textContent=`${name(turn)} \\u306E\\u756A`;$("message").textContent=notice||(moves.length?"\\u5149\\u3063\\u3066\\u3044\\u308B\\u30DE\\u30B9\\u306B\\u7F6E\\u3051\\u307E\\u3059":"\\u7F6E\\u3051\\u308B\\u5834\\u6240\\u304C\\u3042\\u308A\\u307E\\u305B\\u3093");}
  $("hintButton").textContent=showHints?"\\u7F6E\\u3051\\u308B\\u5834\\u6240\\u3092\\u96A0\\u3059":"\\u7F6E\\u3051\\u308B\\u5834\\u6240\\u3092\\u8868\\u793A";
  $("turnText").textContent=jp($("turnText").textContent);$("message").textContent=jp($("message").textContent);$("hintButton").textContent=jp($("hintButton").textContent);
  save();
}
function startGame(size,resume=false){
  if(resume&&load(size)){}else{N=size;board=initialBoard(size);turn=BLACK;finished=false;showHints=true;lastMove=null;}
  $("startScreen").hidden=true;$("gameScreen").hidden=false;$("modeLabel").textContent=`${size} x ${size}`;
  render(resume?"":"\\u30B2\\u30FC\\u30E0\\u30B9\\u30BF\\u30FC\\u30C8\\uFF01 BLACK \\u304B\\u3089\\u59CB\\u3081\\u3088\\u3046");
}
function updateResumeButtons(){
  document.querySelectorAll(".mode-button").forEach(button=>{
    const size=Number(button.dataset.mode);button.querySelector(".resume-button")?.remove();
    if(hasSavedGame(size)){
      const resume=document.createElement("span");resume.className="resume-button";resume.textContent=jp("\\u7D9A\\u304D\\u304B\\u3089");
      resume.addEventListener("click",event=>{event.stopPropagation();startGame(size,true);});button.append(resume);
    }
  });
}
document.querySelectorAll(".mode-button").forEach(button=>button.addEventListener("click",()=>{
  const size=Number(button.dataset.mode);
  if(hasSavedGame(size)&&!confirm(`${size} x ${size}${jp("\\u306E\\u4FDD\\u5B58\\u30C7\\u30FC\\u30BF\\u3092\\u4E0A\\u66F8\\u304D\\u3057\\u3066\\u65B0\\u3057\\u304F\\u59CB\\u3081\\u307E\\u3059\\u304B\\uFF1F")}`))return;
  startGame(size);
}));
$("menuButton").addEventListener("click",()=>{$("gameScreen").hidden=true;$("startScreen").hidden=false;updateResumeButtons();});
$("hintButton").addEventListener("click",()=>{showHints=!showHints;render();});
$("resetButton").addEventListener("click",()=>{if(confirm(jp("\\u30B2\\u30FC\\u30E0\\u3092\\u6700\\u521D\\u304B\\u3089\\u3084\\u308A\\u76F4\\u3057\\u307E\\u3059\\u304B\\uFF1F"))){board=initialBoard(N);turn=BLACK;finished=false;showHints=true;lastMove=null;render(jp("\\u30B2\\u30FC\\u30E0\\u30B9\\u30BF\\u30FC\\u30C8\\uFF01 BLACK \\u304B\\u3089\\u59CB\\u3081\\u3088\\u3046"));}});
updateResumeButtons();
