import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const read = (name) => JSON.parse(fs.readFileSync(path.join(HERE, name), 'utf8'));
const base = read('questions.json');
const extra = read('questions-extra.json');
const fun = read('questions-fun.json');
const curation = read('curation.json');

const all = [...base, ...extra, ...fun];
const byId = new Map(all.map((q) => [q.id, q]));
const specialist = new Set(curation.specialist || []);
const retired = new Set(curation.retire || []);
const statusOf = (q) => retired.has(q.id) ? 'retire' : specialist.has(q.id) ? 'specialist' : 'core';

const GAME_ID = 'internet-timeline';
const SCHEDULE_VERSION = 'schedule-v6';
const CARDS_NEEDED = 6;
const LEGACY_DAYS = 9;
const RECENT_DAYS_BLOCKED = 14;
const ENTITY_COOLDOWN_DAYS = 7;
const SLOT_ROLES = ['anchor','warmup','memory','surprise','tension','stretch'];
const FIXED_DECK_IDS = [
  ['web-2022','web-1994','web-2008','web-2001','web-1976','web-2015'],
  ['web-2024','web-1993','web-2009','web-2000','web-1978','web-2017']
];
const PROFILES = [
  {key:'mix',difficulty:['easy','easy','medium','medium','medium','hard']},
  {key:'culture',categories:['Culture','Gaming','Social','Video','Entertainment','Community'],difficulty:['easy','easy','medium','medium','medium','hard']},
  {key:'builders',categories:['Web','Tech','Search','Cloud','Business','Commerce','Security','Open Source'],difficulty:['easy','easy','medium','medium','medium','hard']},
  {key:'social',categories:['Social','Communication','Community','Culture','Video'],difficulty:['easy','easy','medium','medium','medium','hard']},
  {key:'close',minYear:1994,difficulty:['easy','easy','medium','medium','medium','hard'],close:true},
  {key:'hard',difficulty:['easy','medium','medium','hard','medium','hard']},
  {key:'modern',minYear:2000,difficulty:['easy','easy','medium','medium','medium','hard']}
];
const ENTITY_PATTERNS = [
  [/apple|iphone|ipad|ipod|macintosh|airpods|vision pro/i,'apple'],[/google|gmail|chrome|youtube|android|stadia/i,'google'],[/facebook|meta|instagram|whatsapp|threads|messenger/i,'meta'],[/openai|chatgpt|gpt-|dall|sora/i,'openai'],[/twitter|\bx\b|vine/i,'twitter'],[/tiktok|musical\.ly|bytedance/i,'tiktok'],[/bitcoin/i,'bitcoin'],[/amazon|aws|kindle|twitch/i,'amazon'],[/microsoft|windows|xbox|linkedin|skype/i,'microsoft'],[/nintendo|pokemon|wii|switch/i,'nintendo'],[/netflix/i,'netflix'],[/spotify/i,'spotify'],[/reddit/i,'reddit']
];

function hashSeed(input){let hash=2166136261;for(let i=0;i<input.length;i++){hash^=input.charCodeAt(i);hash=Math.imul(hash,16777619)}return hash>>>0}
function profileForPuzzle(n){return n<=2?PROFILES[0]:PROFILES[(n-3)%PROFILES.length]}
function eraBucket(y){return y<1990?0:y<2000?1:y<2010?2:y<2020?3:4}
function difficultyOf(q){if(q.difficulty)return q.difficulty;if(q.answerYear<1988)return'hard';if(q.answerYear>=2001&&['Social','Gaming','AI','Mobile','Entertainment','Culture'].includes(q.category))return'easy';if(['Security','Web'].includes(q.category)&&q.answerYear<1995)return'hard';return'medium'}
function appealOf(q){if(q.appeal)return q.appeal;if(q.id.startsWith('web-'))return q.answerYear>=1994?'mainstream':'known';if(difficultyOf(q)==='hard'&&q.answerYear<1995)return'niche';if(['Social','Gaming','Culture','Entertainment','AI','Mobile','Video'].includes(q.category))return'mainstream';return'known'}
function entityOf(q){if(q.entity)return q.entity;const text=`${q.id} ${q.prompt}`;return ENTITY_PATTERNS.find(([re])=>re.test(text))?.[1]??q.id}
function isFun(q){return q.id.startsWith('fun-')||['Culture','Gaming','Entertainment','Video','Social','Community'].includes(q.category)}
function profilePenalty(q,p){let v=0;if(p.categories&&!p.categories.includes(q.category))v+=260;if(p.minYear&&q.answerYear<p.minYear)v+=280;if(p.maxYear&&q.answerYear>p.maxYear)v+=280;return v}
function rolePenalty(q,role,p){const appeal=appealOf(q),difficulty=difficultyOf(q);let v=0;if(role==='anchor'){if(appeal!=='mainstream')v+=appeal==='known'?180:650;if(difficulty==='hard')v+=700}if(role==='warmup'){if(appeal==='niche')v+=600;if(difficulty==='hard')v+=600}if(role==='memory'&&appeal==='niche')v+=350;if(role==='surprise'){if(!isFun(q))v+=240;if(appeal==='niche')v+=300}if(role==='tension'){if(difficulty==='easy')v+=80;if(appeal==='niche')v+=240}if(role==='stretch'&&p.key!=='hard'&&appeal==='niche')v+=400;if(p.key!=='hard'&&difficulty==='hard'&&role!=='stretch')v+=450;return v}
function candidateScore(q,selected,dayIndex,slot,p,recentEntities){const tie=hashSeed(`${GAME_ID}:${SCHEDULE_VERSION}:${dayIndex}:${slot}:${q.id}:${p.key}`)/0xffffffff;const target=p.difficulty[slot]??'medium',role=SLOT_ROLES[slot]??'memory';const difficultyPenalty=difficultyOf(q)===target?0:220;const sameYearPenalty=selected.some(x=>x.answerYear===q.answerYear)?10000:0;const sameEntityPenalty=selected.some(x=>entityOf(x)===entityOf(q))?900:recentEntities.has(entityOf(q))?170:0;const eraCount=selected.filter(x=>eraBucket(x.answerYear)===eraBucket(q.answerYear)).length;const categoryCount=selected.filter(x=>x.category===q.category).length;const nicheCount=selected.filter(x=>appealOf(x)==='niche').length;const nichePenalty=appealOf(q)==='niche'&&nicheCount>=1?700:0;const minDist=selected.length?Math.min(...selected.map(x=>Math.abs(x.answerYear-q.answerYear))):50;const distanceTerm=p.close?Math.min(minDist,20)*1.8:-Math.min(minDist,20)*1.1;return sameYearPenalty+sameEntityPenalty+nichePenalty+profilePenalty(q,p)+rolePenalty(q,role,p)+difficultyPenalty+categoryCount*92+eraCount*24+distanceTerm+tie}
function fixedDeck(index){const ids=FIXED_DECK_IDS[index];if(!ids)return null;const deck=ids.map(id=>byId.get(id)).filter(Boolean);return deck.length===CARDS_NEEDED?deck:null}
function buildDeck(dayIndex,recentDays,profile){const blocked=new Set(recentDays.flat().map(q=>q.id));const recentEntities=new Set(recentDays.slice(-ENTITY_COOLDOWN_DAYS).flat().map(entityOf));const active=all.filter(q=>statusOf(q)!=='retire'&&(profile.key==='hard'||statusOf(q)==='core'));const available=active.filter(q=>!blocked.has(q.id));const pool=available.length>=CARDS_NEEDED?available:active;const selected=[];for(let slot=0;slot<CARDS_NEEDED;slot++){const unique=pool.filter(q=>!selected.some(x=>x.id===q.id||x.answerYear===q.answerYear));const remaining=(unique.length?unique:pool.filter(q=>!selected.some(x=>x.id===q.id))).sort((a,b)=>candidateScore(a,selected,dayIndex,slot,profile,recentEntities)-candidateScore(b,selected,dayIndex,slot,profile,recentEntities));if(!remaining[0])throw new Error('Not enough questions');selected.push(remaining[0])}return selected}

const problems=[];
const scheduled=[];
for(let i=0;i<LEGACY_DAYS+60;i++){
  const pinned=fixedDeck(i);
  if(pinned){scheduled.push(pinned);continue}
  const p=profileForPuzzle(i+1);
  const recent=scheduled.slice(Math.max(0,scheduled.length-RECENT_DAYS_BLOCKED));
  const deck=buildDeck(i,recent,p);
  scheduled.push(deck);
  if(i<LEGACY_DAYS)continue;

  const n=i+1;
  const ids=deck.map(q=>q.id);
  const years=deck.map(q=>q.answerYear);
  const hard=deck.filter(q=>difficultyOf(q)==='hard').length;
  const niche=deck.filter(q=>appealOf(q)==='niche').length;
  const mainstream=deck.filter(q=>appealOf(q)==='mainstream').length;
  const funCount=deck.filter(isFun).length;
  const retiredCount=deck.filter(q=>statusOf(q)==='retire').length;
  const specialistCount=deck.filter(q=>statusOf(q)==='specialist').length;
  const prior14=new Set(recent.flat().map(q=>q.id));

  if(new Set(ids).size!==CARDS_NEEDED)problems.push(`#${n}: duplicate question in same deck`);
  if(new Set(years).size!==CARDS_NEEDED)problems.push(`#${n}: same-year collision`);
  if(ids.some(id=>prior14.has(id)))problems.push(`#${n}: repeats a question from previous 14 days`);
  if(retiredCount)problems.push(`#${n}: contains retired question`);
  if(p.key!=='hard'&&specialistCount)problems.push(`#${n}: normal Daily contains specialist question`);
  if(p.key!=='hard'&&hard>1)problems.push(`#${n}: normal Daily has ${hard} hard cards`);
  if(p.key==='hard'&&hard>2)problems.push(`#${n}: Hard Mode has ${hard} hard cards`);
  if(p.key!=='hard'&&niche>1)problems.push(`#${n}: normal Daily has ${niche} niche cards`);
  if(p.key!=='hard'&&mainstream<2)problems.push(`#${n}: only ${mainstream} mainstream cards`);
  if(funCount<1)problems.push(`#${n}: no fun/relatable card`);
  if(appealOf(deck[0])==='niche'||difficultyOf(deck[0])==='hard')problems.push(`#${n}: anchor is too hostile (${deck[0].id})`);
  if(appealOf(deck[1])==='niche'||difficultyOf(deck[1])==='hard')problems.push(`#${n}: warmup is too hostile (${deck[1].id})`);
}

if(problems.length){
  console.error(`Internet Timeline quality gate FAILED with ${problems.length} problem(s):`);
  for(const p of problems)console.error(`- ${p}`);
  process.exit(1);
}
console.log(`Internet Timeline quality gate passed: ${60} future Daily decks checked.`);
console.log(`Pool: ${all.length} total / ${all.filter(q=>statusOf(q)==='core').length} core / ${specialist.size} specialist / ${retired.size} retired.`);
