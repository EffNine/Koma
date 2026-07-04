export type MessageTone = 'info' | 'ok' | 'warn' | 'err';

export interface AppMessage {
  text: string;
  tone: MessageTone;
}

export function messageClass(tone: MessageTone): string {
  switch (tone) {
    case 'ok':
      return 'msg ok';
    case 'warn':
      return 'msg warn';
    case 'err':
      return 'msg errbox';
    case 'info':
    default:
      return 'msg';
  }
}

export function toneLabel(tone: MessageTone): string {
  switch (tone) {
    case 'ok':
      return 'Success';
    case 'warn':
      return 'Warning';
    case 'err':
      return 'Error';
    case 'info':
    default:
      return 'Info';
  }
}
