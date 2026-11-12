const N=8, EMPTY=0, BLACK=1, WHITE=2;
const DIRS=[[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]];
const $=id=>document.getElementById(id);
let board,turn,finished,showHints,lastMove;

function initialBoard(){
  const b=Array.from({length:N},()=>Array(N).fill(EMPTY));
  b[3][3]=WHITE;b[3][4]=BLACK;b[4][3]=BLACK;b[4][4]=WHITE;return b;
}
const other=p=>p===BLACK?WHITE:BLACK;
const name=p=>p===BLACK?"BLACK":"WHITE";

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
    else notice=`${name(passed)} は置ける場所がないためパス！`;
  }
  render(notice);
}
function render(notice=""){
  const boardEl=$("board");boardEl.innerHTML="";
  const moves=finished?[]:legalMoves(turn),legal=new Set(moves.map(([r,c])=>`${r},${c}`));
  for(let r=0;r<N;r++)for(let c=0;c<N;c++){
    const cell=document.createElement("button");cell.type="button";cell.className="cell";
    cell.setAttribute("role","gridcell");
    const v=board[r][c],key=`${r},${c}`;
    if(v){const stone=document.createElement("span");stone.className=`stone ${v===BLACK?"black":"white"}`;cell.append(stone);cell.setAttribute("aria-label",`${r+1}行${c+1}列 ${name(v)}`);}
    else cell.setAttribute("aria-label",`${r+1}行${c+1}列`);
    if(!v&&showHints&&legal.has(key))cell.classList.add("hint");
    if(lastMove&&lastMove[0]===r&&lastMove[1]===c)cell.classList.add("last-move");
    cell.disabled=!!v||!legal.has(key)||finished;cell.addEventListener("click",()=>move(r,c));boardEl.append(cell);
  }
  const {b,w}=scores();$("blackScore").textContent=b;$("whiteScore").textContent=w;
  $("blackPanel").classList.toggle("active",!finished&&turn===BLACK);
  $("whitePanel").classList.toggle("active",!finished&&turn===WHITE);
  $("turnDot").className=`dot ${turn===BLACK?"black-dot":"white-dot"}`;
  if(finished){
    $("turnText").textContent="GAME OVER";
    const result=b===w?"引き分け！":`${b>w?"BLACK":"WHITE"} の勝ち！`;
    $("message").textContent=`${result}  BLACK ${b} - WHITE ${w}`;
  }else{$("turnText").textContent=`${name(turn)} の番です`;$("message").textContent=notice||(moves.length?"光っているマスに置けます":"置ける場所がありません");}
  $("hintButton").textContent=showHints?"置ける場所を隠す":"置ける場所を表示";
}
function reset(){board=initialBoard();turn=BLACK;finished=false;showHints=true;lastMove=null;render("ゲームスタート！ BLACK から始めよう");}
$("hintButton").addEventListener("click",()=>{showHints=!showHints;render();});
$("resetButton").addEventListener("click",()=>{if(confirm("ゲームを最初からやり直しますか？"))reset();});
reset();
