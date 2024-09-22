import { ChatInterface, GenerationConfig } from "@mlc-ai/web-llm";
import { MusicLogitProcessor } from "./music_logit_processor";
import { AUTOREGRESS } from "./music_transformer_vocab";

export type GenerationProgressCallback = (
  generated: number,
  total: number
) => void;

export class ChunkGenerator {
  genConfig?: GenerationConfig;
  pauseRequested: boolean = false;
  interruptRequested: boolean = false;

  setGenConfig(genConfig: GenerationConfig) {
    this.genConfig = genConfig;
  }

  setPause(pauseRequested: boolean = true) {
    this.pauseRequested = pauseRequested;
  }

  interrupt() {
    this.interruptRequested = true;
  }

  /**
   *
   * @param chat The ChatModule reloaded already.
   * @param musicLogitProcessor Music logit processor that resides in `chat` as well.
   * @yields First chunk has 1020 tokens, subsequent ones are 510 tokens.
   */
  async *chunkGenerate(
    chat: ChatInterface,
    musicLogitProcessor: MusicLogitProcessor,
    callback: GenerationProgressCallback,
    prompt: Array<number> = []
  ): AsyncGenerator<Array<number>, void, void> {
    let startTime;

    if (prompt.length != 0) {
      const offset = prompt[0];
      for (let i = 0; i < prompt.length; i += 3) {
        prompt[i] -= offset;
      }
      startTime = prompt[prompt.length - 3];
    } else {
      startTime = 0;
    }
    prompt.unshift(AUTOREGRESS);
    console.log("Worker: received prompt: ", prompt);

    // Generate first token
    let nextToken = await chat.forwardTokensAndSample(
      prompt,
      /*isPrefill=*/ true,
      this.genConfig
    );
    console.log("Worker: received first token: ", nextToken);
    let tokenToGenerate = 1020 - prompt.length + 1;
    let tokenGenerated = 1;

    // 1. Generate first 1020 tokens
    while (
      !this.interruptRequested &&
      musicLogitProcessor.tokenSequence.length < tokenToGenerate
    ) {
      nextToken = await chat.forwardTokensAndSample(
        [nextToken],
        /*isPrefill=*/ false,
        this.genConfig
      );

      tokenGenerated++;
      if (!this.pauseRequested) {
        callback(tokenGenerated, tokenToGenerate);
      }
    }

    console.log("Worker: start time: ", startTime);
    prompt = [...musicLogitProcessor.tokenSequence];
    for (let i = 0; i < tokenToGenerate; i += 3) {
      prompt[i] -= startTime;
    }

    if (this.interruptRequested) {
      musicLogitProcessor.resetState();
      yield Promise.reject("Interrupted");
      return;
    } else {
      yield Promise.resolve(prompt);
    }

    tokenToGenerate = 510;

    // 2. Take last 510 tokens, make it the new prompt, starting from time 0
    prompt = prompt.slice(Math.max(prompt.length - tokenToGenerate, 0));;
    startTime = prompt[0];
    for (let i = 0; i < tokenToGenerate; i += 3) {
      prompt[i] -= startTime;
    }

    // 3. Clear KV cache and logitProcessor.tokenSequence
    chat.resetChat(/*keepStats=*/ true);

    // 4. Keep generating chunks of 510 tokens
    let cycles = 0; // Number of 510-token chunks generated after the first 1020 tokens
    while (!this.interruptRequested) {
      // TODO: change to a user-triggered stop
      let startTime = prompt[prompt.length - 3];

      // 4.1. Prefill prompt and get first token
      musicLogitProcessor.curTime = startTime; // Update curTime so `future_logits()` still work
      prompt.unshift(AUTOREGRESS); // Add the AUTOREGRESS prompt back in, making the prompt 511

      nextToken = await chat.forwardTokensAndSample(
        prompt,
        /*isPrefill=*/ true,
        this.genConfig
      );
      if (musicLogitProcessor.tokenSequence.length != 1) {
        throw Error("tokenSequence length should be 1 after prefill.");
      }

      // 4.2. Decode autoregressively
      tokenGenerated = 1;
      while (
        !this.interruptRequested &&
        musicLogitProcessor.tokenSequence.length < tokenToGenerate
      ) {
        nextToken = await chat.forwardTokensAndSample(
          [nextToken],
          /*isPrefill=*/ false,
          this.genConfig
        );
        tokenGenerated++;
        if (!this.pauseRequested) {
          callback(tokenGenerated, tokenToGenerate);
        }
      }

      // 4.3. Take all the tokenSequences (510 of tokens)
      prompt = [...musicLogitProcessor.tokenSequence]; // there are 510 newly generated tokens
      for (let i = 0; i < tokenToGenerate; i += 3) {
        prompt[i] -= startTime;
      }
      if (this.interruptRequested) {
        musicLogitProcessor.resetState();
        yield Promise.reject("Interrupted");
        return;
      } else {
        yield Promise.resolve(prompt);
      }

      // 4.4. Clear KV cache and logitProcessor.tokenSequence
      chat.resetChat(/*keepStats=*/ true);
      cycles += 1;
    }
  }
}
