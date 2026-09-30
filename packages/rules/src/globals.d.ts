// TextEncoder exists in every runtime we target (browsers, workers, Node 22) but is not in lib ES2022.
declare class TextEncoder {
  encode(input?: string): Uint8Array;
}
