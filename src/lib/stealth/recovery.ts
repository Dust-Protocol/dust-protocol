import { sha256 } from '@noble/hashes/sha256';
import { bytesToHex } from '@noble/hashes/utils';
import { storageKey } from '@/lib/storageKey';

// BIP39 English word list subset (256 words) — enough for 96-bit entropy (12 words, 8 bits each)
const WORDS = [
  'abandon','ability','able','about','above','absent','absorb','abstract',
  'absurd','abuse','access','accident','account','accuse','achieve','acid',
  'acoustic','acquire','across','act','action','actor','actress','actual',
  'adapt','add','addict','address','adjust','admit','adult','advance',
  'advice','aerobic','affair','afford','afraid','again','age','agent',
  'agree','ahead','aim','air','airport','aisle','alarm','album',
  'alcohol','alert','alien','all','alley','allow','almost','alone',
  'alpha','already','also','alter','always','amateur','amazing','among',
  'amount','amused','analyst','anchor','ancient','anger','angle','angry',
  'animal','ankle','announce','annual','another','answer','antenna','antique',
  'anxiety','any','apart','apology','appear','apple','approve','april',
  'arch','arctic','area','arena','argue','arm','armed','armor',
  'army','around','arrange','arrest','arrive','arrow','art','artefact',
  'artist','artwork','ask','aspect','assault','asset','assist','assume',
  'asthma','athlete','atom','attack','attend','attitude','attract','auction',
  'audit','august','aunt','author','auto','autumn','average','avocado',
  'avoid','awake','aware','awesome','awful','awkward','axis','baby',
  'bachelor','bacon','badge','bag','balance','balcony','ball','bamboo',
  'banana','banner','bar','barely','bargain','barrel','base','basic',
  'basket','battle','beach','bean','beauty','because','become','beef',
  'before','begin','behave','behind','believe','below','belt','bench',
  'benefit','best','betray','better','between','beyond','bicycle','bid',
  'bike','bind','biology','bird','birth','bitter','black','blade',
  'blame','blanket','blast','bleak','bless','blind','blood','blossom',
  'blow','blue','blur','blush','board','boat','body','boil',
  'bomb','bone','bonus','book','boost','border','boring','borrow',
  'boss','bottom','bounce','box','boy','bracket','brain','brand',
  'brass','brave','bread','breeze','brick','bridge','brief','bright',
  'bring','brisk','broccoli','broken','bronze','broom','brother','brown',
  'brush','bubble','buddy','budget','buffalo','build','bulb','bulk',
  'bullet','bundle','bunny','burden','burger','burst','bus','business',
  'busy','butter','buyer','buzz','cabbage','cabin','cable','cactus',
  'cage','cake','call','calm','camera','camp','can','canal',
  'cancel','candy','cannon','canoe','canvas','canyon','capable','capital',
  'captain','car','carbon','card','cargo','carpet','carry','cart',
];

export function generateRecoveryCode(signature: string, pin: string): string {
  const entropy = sha256(new TextEncoder().encode(`dust-recovery:${signature}:${pin}`));
  const words: string[] = [];
  for (let i = 0; i < 12; i++) {
    words.push(WORDS[entropy[i] % WORDS.length]);
  }
  return words.join(' ');
}

function recoveryHashKey(address: string): string {
  return storageKey('recovery-hash', address);
}

export function storeRecoveryHash(address: string, code: string): void {
  if (typeof window === 'undefined') return;
  const hash = bytesToHex(sha256(new TextEncoder().encode(code.trim().toLowerCase())));
  localStorage.setItem(recoveryHashKey(address), hash);
}

export function verifyRecoveryCode(address: string, code: string): boolean {
  if (typeof window === 'undefined') return false;
  const storedHash = localStorage.getItem(recoveryHashKey(address));
  if (!storedHash) return false;
  const inputHash = bytesToHex(sha256(new TextEncoder().encode(code.trim().toLowerCase())));
  return storedHash === inputHash;
}

export function hasRecoveryHash(address: string): boolean {
  if (typeof window === 'undefined') return false;
  return !!localStorage.getItem(recoveryHashKey(address));
}

export function clearRecoveryHash(address: string): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(recoveryHashKey(address));
}
