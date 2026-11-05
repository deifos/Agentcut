import assert from "node:assert/strict";
import test from "node:test";
import { pendingReply, questionFromReply } from "../lib/studio/pending-input.ts";

const question = "Should it also have a voiceover, or just music with text steps?";
const assistant = (text, extra = {}) => ({ id: "question", role: "assistant", at: 1, status: "done", parts: [{ type: "text", text }], ...extra });
const history = (messages, running = null) => ({ sessionId: "test", messages, running });

test("completed tutorial outline ends in an actionable voiceover question", () => {
  const text = `Here is the outline (45–60 seconds):\n1. The canvas\n2. Each video has its timeline\n3. Check each video opens correctly.\n\n${question}`;
  assert.deepEqual(pendingReply(history([assistant(text)])), { messageId: "question", question });
});

test("Still blocked with numbered choices stays pending despite a declarative ending", () => {
  const text = "The voice and markers are ready.\n\n**Done:**\n- The build is clean.\n\n**Still blocked:** I can't see the canvas screen. Either of these unblocks it:\n1. **A screen recording in the Library panel.** It can be rough.\n2. **Code access.** Supply the app source folder.\n\nOnce I have either, I'll build the scenes and check both formats.";
  const pending = pendingReply(history([assistant(text)]));
  assert.match(pending.question, /can't see the canvas screen/);
  assert.match(pending.question, /1\. A screen recording in the Library panel\./);
  assert.match(pending.question, /2\. Code access\./);
  assert.doesNotMatch(pending.question, /Once I have either|The voice and markers/);
});

for (const text of [
  'The final script says:\n\n"Should it have a voiceover?"',
  "## Narration script\n\nHow do you add a style to your video?",
  "The example:\n\n> Should it have a voiceover?",
  "Ready for review.\n\n```text\nWhat do you want to create?\n```",
  "What if it just worked?",
  "Your editable draft is ready. I checked both formats.",
  "## What should you see?\n\nA saved project in the list.",
]) {
  test(`does not block on quoted/script/rhetorical text or ordinary completion: ${text.slice(0, 40)}`, () => {
    assert.equal(questionFromReply(text), null);
  });
}

test("explicit pending metadata and supported structured requests take precedence", () => {
  assert.equal(pendingReply(history([assistant("Finished.", { pendingInput: { question: "Which voice do you prefer?" } })])).question, "Which voice do you prefer?");
  assert.equal(questionFromReply('```json\n{"status":"needs_input","question":"Please choose a voice."}\n```'), "Please choose a voice.");
  assert.equal(questionFromReply("**Question for you:** Use your voice or captions only?"), "Use your voice or captions only?");
  assert.equal(questionFromReply('{"status":"done","question":"A scripted question?"}'), null);
});

test("generation, error/cancel and submitted or queued replies do not show stale pending state", () => {
  assert.equal(pendingReply(history([assistant(question)], "active-run")), null);
  for (const status of ["running", "error", "cancelled"]) assert.equal(pendingReply(history([assistant(question, { status })])), null);
  for (const status of [undefined, "queued"]) assert.equal(pendingReply(history([assistant(question), { id: "reply", role: "user", at: 2, text: "Use a voiceover", status }])), null);
});
