import { messageClass, toneLabel } from '../src/lib/ui/feedback';

let failures = 0;
function assert(cond: boolean, msg: string) {
  if (!cond) {
    failures++;
    console.error('FAIL: ' + msg);
  }
}

assert(messageClass('ok') === 'msg ok', 'ok message class');
assert(messageClass('warn') === 'msg warn', 'warn message class');
assert(messageClass('err') === 'msg errbox', 'err message class');
assert(messageClass('info') === 'msg', 'info message class');

assert(toneLabel('ok') === 'Success', 'ok label');
assert(toneLabel('warn') === 'Warning', 'warn label');
assert(toneLabel('err') === 'Error', 'err label');
assert(toneLabel('info') === 'Info', 'info label');

if (failures) {
  console.error(`\n${failures} feedback check(s) failed`);
  process.exit(1);
}
console.log('\nall feedback checks passed');
